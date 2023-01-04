import sequelize from './database.js';
import { Op } from 'sequelize';
import sendAccessRequestAccepted from './mail/sendAccessRequestAccepted.js';
import sendAccessRequestRequested from './mail/sendAccessRequestRequested.js';

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
    const expiry = new Date().setSeconds(
        new Date().getSeconds() +
            res.locals.user.pointerAccessDuration * 24 * 60 * 60,
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
    const requestee = await sequelize.models.User.findOne({
        where: { id: accessRequest.requesteeId },
        include: [sequelize.models.UserName],
    });
    try {
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
