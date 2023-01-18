import sequelize from './database.js';
import { Op } from 'sequelize';
import sendAccessRequestAccepted from './mail/sendAccessRequestAccepted.js';
import sendAccessRequestRequested from './mail/sendAccessRequestRequested.js';
import { decryptRsa, encryptRsa } from './encryption.js';

const createAccessRequest = async (req, res) => {
    const { hash } = req.params;
    const { message } = req.body;
    if (!hash) {
        req.flash(
            'error',
            'There was an error creating your request. Please try again.',
        );
        return res.redirect('/profile');
    }
    const requester = res.locals.user;
    const requestee = await sequelize.models.User.findOne({
        where: { hash },
        include: [sequelize.models.UserName],
    });
    if (!requestee) {
        req.flash(
            'error',
            'There was an error creating your request. Please try again.',
        );
        return res.redirect(`/u/${hash}`);
    }
    if (requestee.id === requester.id) {
        req.flash('error', 'You cannot send a request to yourself.');
        return res.redirect(`/u/${hash}`);
    }
    const existingAccessRequest = await sequelize.models.AccessRequest.findOne({
        where: {
            requesterId: requester.id,
            requesteeId: requestee.id,
        },
    });
    if (existingAccessRequest) {
        existingAccessRequest.set({
            accepted: false,
            pending: true,
            message: message.trim(),
            expiry: new Date(),
        });
        await existingAccessRequest.save();
        return res.redirect(`/u/${hash}`);
    } else {
        sequelize.models.AccessRequest.create({
            requesterId: requester.id,
            requesteeId: requestee.id,
            accepted: false,
            pending: true,
            message: message.trim(),
        })
            .then(async (accessRequest) => {
                try {
                    await sendAccessRequestRequested(
                        requester,
                        requestee,
                        accessRequest,
                    );
                    return res.redirect(`/u/${hash}`);
                } catch (err) {
                    console.log(err);
                    req.flash(
                        'error',
                        'There was an error creating your request. Please try again.',
                    );
                    return res.redirect(`/u/${hash}`);
                }
            })
            .catch((err) => {
                console.log(err);
                req.flash(
                    'error',
                    'There was an error creating your request. Please try again.',
                );
                return res.redirect(`/u/${hash}`);
            });
    }
};

const deleteAccessRequest = async (req, res) => {
    const { hash } = req.params;
    const accessRequest = await sequelize.models.AccessRequest.findOne({
        where: {
            [Op.or]: [
                { requesterId: res.locals.user.id },
                { requesteeId: res.locals.user.id },
            ],
            hash,
        },
    });
    if (!accessRequest) {
        req.flash(
            'error',
            'There was an error deleting your request. Please try again.',
        );
        return res.redirect('/profile');
    }
    // Delete all pointer keys associated with this access request.
    await sequelize.models.PointerKey.destroy({
        where: { AccessRequestId: accessRequest.id },
    });
    await accessRequest.destroy();
    return res.redirect('/profile');
};

const acceptAccessRequest = async (req, res) => {
    const { hash } = req.params;
    const accessRequest = await sequelize.models.AccessRequest.findOne({
        where: {
            hash,
            requesteeId: res.locals.user.id,
            pending: true,
            accepted: false,
        },
    });
    if (!accessRequest) {
        req.flash(
            'error',
            'There was an error accepting this request. Please try again.',
        );
        return res.redirect('/profile');
    }
    try {
        const requestee = await sequelize.models.User.findOne({
            where: { id: accessRequest.requesteeId },
            include: [sequelize.models.UserName],
        });
        const expiry = new Date().setSeconds(
            new Date().getSeconds() +
                requestee.pointerAccessDuration * 24 * 60 * 60,
        );
        accessRequest.set({
            accepted: true,
            pending: false,
            expiry,
        });
        await accessRequest.save();
        const requester = await sequelize.models.User.findOne({
            where: { id: accessRequest.requesterId },
            include: [sequelize.models.UserName],
        });
        // For each requestee pointer we're sharing, generate a new pointer key for the requester
        const pointers = await sequelize.models.Pointer.findAll({
            where: { userId: requestee.id },
            raw: true,
        });
        // 1. Use the requestee's password-derived key to decrypt their private key
        const passwordDerivedKey = req.session.user.key;
        const privateKey = await requestee.getPrivateKey(passwordDerivedKey);
        for (const pointer of pointers) {
            // 1. Find the pointer encryption key for the requestee
            const pointerKeyPayload = await sequelize.models.PointerKey.findOne(
                {
                    where: { PointerId: pointer.id, UserId: requestee.id },
                    attributes: ['encryptedKey'],
                    raw: true,
                },
            );
            const encryptedRequesteeKey = pointerKeyPayload?.encryptedKey;
            if (!encryptedRequesteeKey) {
                continue;
            }
            // 2. Decrypt the pointer encryption key
            const pointerKey = decryptRsa(encryptedRequesteeKey, privateKey);
            // 3. Encrypt the decrypted pointer key for the requester, using the requester's public key
            const encryptedRequesterKey = encryptRsa(
                pointerKey,
                requester.publicKey,
            );
            // 4. Save the new pointer key
            await sequelize.models.PointerKey.create({
                UserId: requester.id,
                PointerId: pointer.id,
                AccessRequestId: accessRequest.id,
                encryptedKey: encryptedRequesterKey,
            });
        }
        await sendAccessRequestAccepted(requester, requestee, accessRequest);
        return res.redirect('/profile');
    } catch (err) {
        console.log(err);
        req.flash(
            'error',
            'There was an error accepting this request. Please try again.',
        );
        return res.redirect('/profile');
    }
};

const getAccess = async (requesterId, requesteeId) => {
    if (!requesterId || !requesteeId) {
        return false;
    }
    // If the requester is the same as the requestee, it's the user's own profile
    if (requesterId === requesteeId) {
        return {
            accepted: true,
            pending: false,
            active: true,
        };
    }
    const request = await sequelize.models.AccessRequest.findOne({
        where: {
            requesterId,
            requesteeId,
        },
    });
    if (!request) {
        return {
            accepted: false,
            pending: false,
            active: false,
        };
    }
    return {
        accepted: !!request.accepted,
        pending: !!request.pending,
        active: request.expiry > new Date(),
    };
};

export {
    createAccessRequest,
    deleteAccessRequest,
    acceptAccessRequest,
    getAccess,
};
