import express from 'express';
import sequelize from './lib/database.js';
import { Op } from 'sequelize';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import mailgun from './lib/mailgun.js';
import {
    redirectIfNotLoggedIn,
    deleteExpiredPointerKeys,
} from './lib/middleware.js';
import {
    createPointer,
    decryptPointer,
    deletePointer,
    encryptPointerData,
    updatePointer,
    updatePointerIcon,
} from './lib/pointer.js';
import { createName, deleteName, setNameAsMain } from './lib/name.js';
import { deleteProfile, updateProfile } from './lib/profile.js';
import {
    createAccessRequest,
    deleteAccessRequest,
    acceptAccessRequest,
    getAccess,
} from './lib/accessRequests.js';
import {
    deriveKey,
    encrypt,
    encryptRsa,
    generateKeyPair,
} from './lib/encryption.js';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { searchUsers } from './lib/search.js';

const api = express.Router();
const frontend = express.Router();
const auth = express.Router();

frontend.all('*', deleteExpiredPointerKeys);

frontend.get('/', async (req, res) => {
    const totalUsers = await sequelize.models.User.count();
    res.render('index', { totalUsers });
});

frontend.get('/login', (req, res) => {
    res.render('login', {
        error: req.flash('error'),
        success: req.flash('success'),
    });
});

frontend.get('/register', (req, res) => {
    res.render('register', {
        error: req.flash('error'),
        success: req.flash('success'),
    });
});

frontend.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

frontend.get('/validate/:validationToken', async (req, res) => {
    const { validationToken } = req.params;
    const user = await sequelize.models.User.findOne({
        where: { validationToken },
    });
    if (user) {
        user.validationToken = null;
        user.validated = true;
        await user.save();
        req.flash(
            'success',
            'Your account has been validated. You can now log in.',
        );
        return res.redirect('/login');
    } else {
        req.flash(
            'error',
            'Invalid validation token. If you need a new token, <a href="/resend-validation">click here</a> to resend the validation email.',
        );
        return res.redirect('/login');
    }
});

frontend.get('/resend-validation', (req, res) => {
    res.render('resend-validation', {
        error: req.flash('error'),
        success: req.flash('success'),
    });
});

frontend.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
        error: req.flash('error'),
        success: req.flash('success'),
    });
});

frontend.get('/reset-password/:resetToken', async (req, res) => {
    const { resetToken } = req.params;
    const user = await sequelize.models.User.findOne({ where: { resetToken } });
    if (user) {
        res.render('reset-password', {
            error: req.flash('error'),
            success: req.flash('success'),
            resetToken,
            emailAddress: user.emailAddress,
        });
    } else {
        req.flash('error', 'Invalid reset token.');
        return res.redirect('/login');
    }
});

frontend.get('/profile', redirectIfNotLoggedIn, async (req, res) => {
    const user = await sequelize.models.User.findOne({
        where: { id: res.locals.user.id },
        attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
    });
    const userNames = await sequelize.models.UserName.findAll({
        where: { UserId: res.locals.user.id },
        raw: true,
    });
    const pointers = await sequelize.models.Pointer.findAll({
        where: { UserId: res.locals.user.id },
        raw: true,
        nest: true,
    });
    const accessRequestsAsRequestee =
        await sequelize.models.AccessRequest.findAll({
            where: { requesteeId: res.locals.user.id },
            raw: true,
        });
    for (const accessRequest of accessRequestsAsRequestee) {
        accessRequest.requester = await sequelize.models.User.findOne({
            where: { id: accessRequest.requesterId },
            attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
            include: [sequelize.models.UserName],
            raw: true,
            nest: true,
        });
    }
    const accessRequestsAsRequester =
        await sequelize.models.AccessRequest.findAll({
            where: { requesterId: res.locals.user.id },
            raw: true,
        });
    for (const accessRequest of accessRequestsAsRequester) {
        accessRequest.requestee = await sequelize.models.User.findOne({
            where: { id: accessRequest.requesteeId },
            attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
            include: [sequelize.models.UserName],
            raw: true,
            nest: true,
        });
    }
    // Decrypt the pointers with our private key
    for (const pointer of pointers) {
        try {
            pointer.data = await decryptPointer(
                pointer.hash,
                req.session.user.id,
                req.session.user.key,
            );
            pointer.PointerKeys = undefined;
        } catch (err) {
            console.error(err);
            return res.render('404');
        }
    }
    res.render('profile', {
        user: { ...user.toJSON(), names: userNames },
        pointers,
        accessRequestsAsRequestee,
        accessRequestsAsRequester,
        error: req.flash('error'),
        success: req.flash('success'),
    });
});

frontend.get('/pointer/:hash/edit', redirectIfNotLoggedIn, async (req, res) => {
    const { hash } = req.params;
    const pointer = await sequelize.models.Pointer.findOne({ where: { hash } });
    if (pointer.UserId !== res.locals.user.id) {
        req.flash('error', 'You do not have permission to edit this pointer.');
        return res.redirect('/profile');
    }
    try {
        pointer.data = await decryptPointer(
            pointer.hash,
            req.session.user.id,
            req.session.user.key,
        );
        res.render('edit-pointer', {
            error: req.flash('error'),
            success: req.flash('success'),
            pointer,
        });
    } catch (err) {
        console.error(err);
        return res.render('404');
    }
});

frontend.get('/profile/edit', redirectIfNotLoggedIn, async (req, res) => {
    const user = await sequelize.models.User.findOne({
        where: { id: res.locals.user.id },
        attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
    });
    res.render('edit-profile', {
        user: user,
        error: req.flash('error'),
        success: req.flash('success'),
    });
});

frontend.get('/search', redirectIfNotLoggedIn, async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.render('search');
    }
    if (q.length < 3) {
        return res.render('search', {
            error: 'Search query must be at least 3 characters long.',
        });
    }
    const users = await searchUsers(q);
    // Add remote results from federated instances ('peers')
    const peersConfig = JSON.parse(
        await readFile(new URL('./config/peers.json', import.meta.url)),
    );
    for (const peer of peersConfig.peers) {
        try {
            const { data } = await axios.get(
                `${peer.url}/api/search?q=${encodeURIComponent(q)}`,
            );
            data.forEach((user) => {
                user.peer = peer;
            });
            users.push(...data);
        } catch (err) {
            // If it's a 404, it's because the peer is running an older version
            // and doesn't have the search endpoint. We can ignore it.
            if (err.response.status !== 404) {
                console.error(err);
            }
        }
    }
    res.render('search', { users, q });
});

frontend.get('/u/:hash', async (req, res) => {
    const { hash } = req.params;
    const user = await sequelize.models.User.findOne({
        where: { hash },
        attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
        include: [
            {
                model: sequelize.models.UserName,
                attributes: ['name', 'main'],
            },
        ],
    });
    if (!user) {
        return res.render('404');
    }
    const pointers = await sequelize.models.Pointer.findAll({
        where: { UserId: user.id },
        attributes: ['data', 'id', 'hash'],
    });
    try {
        const viewingUser = await sequelize.models.User.findOne({
            where: { id: res.locals.user?.id },
        });
        // Attempt to decrypt the pointers
        const decryptedPointers = [];
        for (const pointer of pointers) {
            const pointerData = await decryptPointer(
                pointer.hash,
                viewingUser.id,
                req.session.user.key,
            );
            if (!pointerData) {
                // We can't decrypt this pointer, so skip it
                continue;
            }
            pointerData.domain = new URL(pointerData.url).hostname;
            pointer.data = pointerData;
            decryptedPointers.push(pointer);
        }
        res.render('user', {
            user,
            pointers: decryptedPointers,
            access: await getAccess(viewingUser.id, user.id),
        });
    } catch (err) {
        // If there isn't a user session (we're not logged in), then we can't decrypt
        // the pointers, so we just bail here
        console.error(err);
        return res.render('user', {
            user,
            pointers: [],
            access: await getAccess(null, user.id),
        });
    }
});

api.get('/healthcheck', (req, res) => {
    res.send('OK');
});

auth.post('/login', (req, res) => {
    const { emailAddress, password } = req.body;
    if (!emailAddress || !password) {
        req.flash('error', 'Please provide an email address and password.');
        return res.redirect('/login');
    }
    sequelize.models.User.findOne({ where: { emailAddress } })
        .then((user) => {
            if (!user) {
                req.flash('error', 'Incorrect email address or password.');
                return res.redirect('/login');
            }
            bcrypt
                .compare(password, user.password)
                .then(async (result, err) => {
                    if (err) {
                        return res.status(500).send(err);
                    }
                    if (!result) {
                        req.flash(
                            'error',
                            'Incorrect email address or password.',
                        );
                        return res.redirect('/login');
                    }
                    if (!user.validated) {
                        req.flash(
                            'error',
                            'Please validate your email address to log in. If you have not received a validation email, please check your spam folder or <a href="/resend-validation">click here</a> to resend the validation email.',
                        );
                        return res.redirect('/login');
                    }
                    let passwordDerivedKey;
                    // If the user doesn't have an RSA key pair, generate one
                    // (this is the case for users who registered before encryption was introduced)
                    if (!user.publicKey || !user.privateKey) {
                        // Generate a new key pair
                        const { publicKey, privateKey } = generateKeyPair();
                        // Create a password-derived key to encrypt/decrypt the private key
                        passwordDerivedKey = deriveKey(password, user.salt);
                        // Encrypt the private key with the password-derived key
                        const encryptedKey = encrypt(
                            privateKey,
                            passwordDerivedKey,
                        );
                        // Save the key pair to the database
                        await sequelize.models.User.update(
                            { publicKey, privateKey: encryptedKey },
                            { where: { id: user.id } },
                        );
                        // Also encrypt all of the user's pointers with the new encryption key
                        const pointers = await sequelize.models.Pointer.findAll(
                            {
                                where: { userId: user.id },
                            },
                        );
                        for (const pointer of pointers) {
                            // Check if the pointer data is already encrypted
                            // by attempting to JSON parse it
                            try {
                                JSON.parse(pointer.data);
                            } catch (e) {
                                // The pointer data is already encrypted, so we can skip it
                                continue;
                            }
                            const { encryptedData, pointerKey } =
                                encryptPointerData(JSON.parse(pointer.data));
                            // Encrypt the pointer key with the user's public key
                            const encryptedKey = encryptRsa(
                                pointerKey,
                                publicKey,
                            );
                            // Save the pointer
                            await sequelize.models.Pointer.update(
                                {
                                    data: encryptedData,
                                },
                                { where: { id: pointer.id } },
                            );
                            // Save the encrypted pointer key
                            await sequelize.models.PointerKey.create({
                                UserId: user.id,
                                PointerId: pointer.id,
                                encryptedKey,
                            });
                        }
                    }
                    // If the user already has an key pair, we don't need to generate one
                    // and we don't make use of it at this stage.
                    // Derive the user's password-based key from the password
                    // and add it to the session
                    passwordDerivedKey = deriveKey(password, user.salt);
                    req.session.loggedIn = true;
                    req.session.user = {
                        emailAddress: user.emailAddress,
                        id: user.id,
                        key: passwordDerivedKey,
                    };
                    req.session.save(() => {
                        res.redirect('/profile');
                    });
                });
        })
        .catch((err) => {
            return res.status(500).send(err);
        });
});

auth.post('/register', (req, res) => {
    const { emailAddress, password, names } = req.body;
    if (!emailAddress || !password) {
        req.flash('error', 'Please provide an email address and password.');
        return res.redirect('/register');
    }
    if (password.length < 8) {
        req.flash('error', 'Password must be at least 8 characters long.');
        return res.redirect('/register');
    }
    if (password.length > 72) {
        req.flash('error', 'Password must be less than 72 characters long.');
        return res.redirect('/register');
    }
    // Check if the email address looks like an email address
    if (!emailAddress.match(/^[^@]+@[^@]+\.[^@]+$/)) {
        req.flash('error', 'Invalid email address.');
        return res.redirect('/register');
    }
    if (emailAddress.length > 255) {
        req.flash(
            'error',
            'Email address must be less than 255 characters long.',
        );
        return res.redirect('/register');
    }
    if (!names) {
        req.flash('error', 'Please provide at least one name.');
        return res.redirect('/register');
    }
    const splitNames = names.split(',').map((name) => name.trim());
    if (splitNames.length < 1 || splitNames.length > 5) {
        req.flash('error', 'Please provide between 1 and 5 names.');
        return res.redirect('/register');
    }
    if (splitNames.some((name) => name.length < 3 || name.length > 255)) {
        req.flash('error', 'Names must be between 3 and 255 characters long.');
        return res.redirect('/register');
    }

    sequelize.models.User.findOne({ where: { emailAddress } })
        .then((user) => {
            // Check if the email address is already in use
            // If it is, we still tell the user that the registration was successful
            // to prevent account enumeration attacks
            if (user) {
                // Send an 'account exists' email
                mailgun.messages().send(
                    {
                        from: 'noreply@pointers.website',
                        to: emailAddress,
                        subject: 'Your Pointers account',
                        text: `You just tried to create an account on Pointers, but an account already exists with the email address ${emailAddress}. If you need to reset your password, please visit https://pointers.website/forgot-password.`,
                    },
                    (error) => {
                        if (error) {
                            console.log(error);
                            req.flash(
                                'error',
                                'There was an error sending the validation email. Please try again.',
                            );
                            return res.redirect('/register');
                        } else {
                            req.flash(
                                'success',
                                'Account created. Please click the link in the email we sent you to validate your account.',
                            );
                            return res.redirect('/login');
                        }
                    },
                );
            } else {
                // From here, we're creating a new account
                const salt = bcrypt.genSaltSync(10);
                const hashedPassword = bcrypt.hashSync(password, salt);
                const validationToken = crypto.randomBytes(16).toString('hex');
                // Generate a new RSA key pair
                const { privateKey, publicKey } = generateKeyPair();
                // Create a password-derived key to encrypt the private key
                const passwordDerivedKey = deriveKey(password, salt);
                // Encrypt the private key with the password-derived key
                const encryptedPrivateKey = encrypt(
                    privateKey,
                    passwordDerivedKey,
                );
                sequelize.models.User.create({
                    emailAddress,
                    password: hashedPassword,
                    salt,
                    validationToken,
                    publicKey,
                    privateKey: encryptedPrivateKey,
                })
                    .then((user) => {
                        // Create a new UserName for each name
                        splitNames.forEach(async (name, index) => {
                            await sequelize.models.UserName.create({
                                name: name.trim(),
                                public: true,
                                main: index === 0,
                                UserId: user.id,
                            }).catch((err) => {
                                console.log(err);
                                req.flash(
                                    'error',
                                    'There was an error creating your account. Please try again.',
                                );
                                return res.redirect('/register');
                            });
                        });
                        mailgun.messages().send(
                            {
                                from: 'noreply@pointers.website',
                                to: emailAddress,
                                subject: 'Please validate your email address',
                                text: `Please click the following link to validate your email address: https://pointers.website/validate/${validationToken}`,
                            },
                            (error) => {
                                if (error) {
                                    console.log(error);
                                    req.flash(
                                        'error',
                                        'There was an error sending the validation email. Please try again.',
                                    );
                                    return res.redirect('/register');
                                } else {
                                    req.flash(
                                        'success',
                                        'Account created. Please click the link in the email we sent you to validate your account.',
                                    );
                                    return res.redirect('/login');
                                }
                            },
                        );
                    })
                    .catch((err) => {
                        console.log(err);
                        req.flash(
                            'error',
                            'There was an error creating your account. Please try again.',
                        );
                        return res.redirect('/register');
                    });
            }
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error creating your account. Please try again.',
            );
            return res.redirect('/register');
        });
});

auth.post('/forgot-password', (req, res) => {
    const { emailAddress } = req.body;
    if (!emailAddress) {
        req.flash('error', 'Please provide an email address.');
        return res.redirect('/forgot-password');
    }
    sequelize.models.User.findOne({ where: { emailAddress } })
        .then((user) => {
            if (!user) {
                // If the user doesn't exist, we still tell the user that the email was sent
                // to prevent account enumeration attacks
                req.flash(
                    'success',
                    'Please click the link in the email we sent you to reset your password.',
                );
                return res.redirect('/forgot-password');
            }
            const resetToken = crypto.randomBytes(16).toString('hex');
            user.resetToken = resetToken;
            user.resetTokenExpiry = Date.now() + 3600000;
            user.save()
                .then(() => {
                    mailgun.messages().send(
                        {
                            from: 'noreply@pointers.website',
                            to: emailAddress,
                            subject: 'Password reset',
                            text: `Please click the following link to reset your password: https://pointers.website/reset-password/${resetToken}`,
                        },
                        (error) => {
                            if (error) {
                                console.log(error);
                                req.flash(
                                    'error',
                                    'There was an error sending the password reset email. Please try again.',
                                );
                            } else {
                                req.flash(
                                    'success',
                                    'Please click the link in the email we sent you to reset your password.',
                                );
                            }
                            return res.redirect('/forgot-password');
                        },
                    );
                })
                .catch((err) => {
                    console.log(err);
                    req.flash(
                        'error',
                        'There was an error sending the password reset email. Please try again.',
                    );
                    return res.redirect('/forgot-password');
                });
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error sending the password reset email. Please try again.',
            );
            return res.redirect('/forgot-password');
        });
});

auth.post('/reset-password', (req, res) => {
    const { password, resetToken } = req.body;
    if (!password || !resetToken) {
        req.flash('error', 'Please provide a password.');
        return res.redirect(`/reset-password/${resetToken}`);
    }
    if (password.length < 8) {
        req.flash('error', 'Password must be at least 8 characters long.');
        return res.redirect(`/reset-password/${resetToken}`);
    }
    if (password.length > 72) {
        req.flash('error', 'Password must be less than 72 characters long.');
        return res.redirect(`/reset-password/${resetToken}`);
    }
    sequelize.models.User.findOne({ where: { resetToken } })
        .then((user) => {
            if (!user) {
                req.flash(
                    'error',
                    'Invalid password reset token. Please reset your password again by visiting <a href="/forgot-password">this page</a>.',
                );
                return res.redirect(`/reset-password/${resetToken}`);
            }
            if (user.resetTokenExpiry < Date.now()) {
                req.flash(
                    'error',
                    'Password reset token has expired. Please reset your password again by visiting <a href="/forgot-password">this page</a>.',
                );
                return res.redirect(`/reset-password/${resetToken}`);
            }
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(password, salt);
            user.password = hashedPassword;
            user.salt = salt;
            user.resetToken = null;
            user.resetTokenExpiry = null;
            user.save()
                .then(() => {
                    req.flash('success', 'Password reset. You can now log in.');
                    return res.redirect('/login');
                })
                .catch((err) => {
                    console.log(err);
                    req.flash(
                        'error',
                        'There was an error resetting your password. Please try again.',
                    );
                    return res.redirect(`/reset-password/${resetToken}`);
                });
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error resetting your password. Please try again.',
            );
            return res.redirect(`/reset-password/${resetToken}`);
        });
});

auth.post('/resend-validation', async (req, res) => {
    const { emailAddress } = req.body;
    if (!emailAddress) {
        req.flash('error', 'Please provide an email address.');
        return res.redirect('/resend-validation');
    }
    sequelize.models.User.findOne({ where: { emailAddress } })
        .then((user) => {
            if (user) {
                const validationToken = crypto.randomBytes(16).toString('hex');
                user.validationToken = validationToken;
                user.save()
                    .then(() => {
                        mailgun.messages().send(
                            {
                                from: 'noreply@pointers.website',
                                to: emailAddress,
                                subject: 'Please validate your email address',
                                text: `Please click the following link to validate your email address: https://pointers.website/validate/${validationToken}`,
                            },
                            (error) => {
                                if (error) {
                                    console.log(error);
                                    req.flash(
                                        'error',
                                        'There was an error sending the validation email. Please try again.',
                                    );
                                } else {
                                    req.flash(
                                        'success',
                                        'Please click the link in the email we sent you to validate your account.',
                                    );
                                }
                                return res.redirect('/resend-validation');
                            },
                        );
                    })
                    .catch((err) => {
                        console.log(err);
                        req.flash(
                            'error',
                            'There was an error sending the validation email. Please try again.',
                        );
                        return res.redirect('/resend-validation');
                    });
            } else {
                // If the user doesn't exist, we still tell the user that the email was sent
                // to prevent account enumeration attacks
                req.flash(
                    'success',
                    'Please click the link in the email we sent you to validate your account.',
                );
                return res.redirect('/resend-validation');
            }
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error sending the validation email. Please try again.',
            );
            return res.redirect('/resend-validation');
        });
});

api.post('/pointer', redirectIfNotLoggedIn, async (req, res) => {
    const { _method } = req.body;
    switch (_method) {
        case 'put':
            return updatePointer(req, res);
        default:
            return createPointer(req, res);
    }
});

api.get('/pointer/:hash/delete', redirectIfNotLoggedIn, async (req, res) => {
    return deletePointer(req, res);
});

api.get('/icon/:hash/update', redirectIfNotLoggedIn, async (req, res) => {
    return updatePointerIcon(req, res);
});

api.post('/profile', redirectIfNotLoggedIn, async (req, res) => {
    return updateProfile(req, res);
});

api.post('/profile/delete', redirectIfNotLoggedIn, async (req, res) => {
    return deleteProfile(req, res);
});

api.post('/name', redirectIfNotLoggedIn, async (req, res) => {
    return createName(req, res);
});

api.get('/name/:hash/delete', redirectIfNotLoggedIn, async (req, res) => {
    return deleteName(req, res);
});

api.get('/name/:hash/set-default', redirectIfNotLoggedIn, async (req, res) => {
    return setNameAsMain(req, res);
});

api.post('/access-request/:hash', redirectIfNotLoggedIn, async (req, res) => {
    return createAccessRequest(req, res);
});

api.get(
    '/access-request/:hash/delete',
    redirectIfNotLoggedIn,
    async (req, res) => {
        return deleteAccessRequest(req, res);
    },
);

api.get(
    '/access-request/:hash/accept',
    redirectIfNotLoggedIn,
    async (req, res) => {
        return acceptAccessRequest(req, res);
    },
);

// Public search API
api.get('/users', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res
            .status(400)
            .json({ error: 'Please provide a search query.' });
    }
    if (q.length < 3) {
        return res.status(400).json({
            error: 'Please provide a search query of at least 3 characters.',
        });
    }
    const users = await searchUsers(q);
    return res.json(users);
});

export { api, frontend, auth };
