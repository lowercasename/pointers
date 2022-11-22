import express from 'express';
import sequelize from './lib/database.js';
import { Op } from 'sequelize';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import mailgun from './lib/mailgun.js';
import { redirectIfNotLoggedIn } from './lib/middleware.js';
import { createPointer, deletePointer, updatePointer } from './lib/pointer.js';
import { createName, deleteName, setNameAsMain } from './lib/name.js';
import { deleteProfile, updateProfile } from './lib/profile.js';
import {
    createAccessRequest,
    deleteAccessRequest,
    acceptAccessRequest,
    getAccess,
} from './lib/accessRequests.js';

const api = express.Router();
const frontend = express.Router();
const auth = express.Router();

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
        where: { emailAddress: res.locals.user.emailAddress },
        attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
        raw: true,
    });
    const userNames = await sequelize.models.UserName.findAll({
        where: { UserId: res.locals.user.id },
        raw: true,
    });
    const pointers = await sequelize.models.Pointer.findAll({
        where: { UserId: res.locals.user.id },
        raw: true,
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
    console.log(pointers);
    res.render('profile', {
        user: { ...user, names: userNames },
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
    res.render('edit-pointer', {
        error: req.flash('error'),
        success: req.flash('success'),
        pointer,
    });
});

frontend.get('/profile/edit', redirectIfNotLoggedIn, async (req, res) => {
    res.render('edit-profile', {
        user: res.locals.user,
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
    const userNames = await sequelize.models.UserName.findAll({
        where: {
            name: {
                [Op.substring]: q,
            },
        },
        include: {
            model: sequelize.models.User,
            attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
        },
        raw: true,
        nest: true,
    });
    const users = userNames.reduce((acc, curr) => {
        if (!curr.User?.id) {
            console.log('no user');
            return acc;
        }
        if (!acc.find((user) => user.id === curr.User.id)) {
            console.log('pushing user');
            acc.push({
                ...curr.User,
                names: [{ name: curr.name, main: curr.main }],
            });
        } else {
            console.log('pushing name');
            acc.find((user) => user.id === curr.User.id).names.push({
                name: curr.name,
                main: curr.main,
            });
        }
        return acc;
    }, []);
    users.forEach((user) => {
        user.names.sort((a, b) => {
            if (a.main && !b.main) {
                return -1;
            } else if (!a.main && b.main) {
                return 1;
            } else {
                return 0;
            }
        });
    });
    res.render('search', { users, q });
});

frontend.get('/u/:hash', redirectIfNotLoggedIn, async (req, res) => {
    const { hash } = req.params;
    const user = await sequelize.models.User.findAll({
        where: { hash },
        attributes: ['id', 'emailAddress', 'bio', 'avatar', 'hash'],
        include: [
            {
                model: sequelize.models.UserName,
                attributes: ['name', 'main'],
            },
            {
                model: sequelize.models.Pointer,
                attributes: ['title', 'description', 'url'],
            },
        ],
    });
    if (!user.length) {
        return res.render('404');
    }
    if (user[0].id === res.locals.user?.id) {
        return res.redirect('/profile');
    }
    res.render('user', {
        user: user[0],
        access: await getAccess(res.locals.user.id, user[0].id),
    });
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
            bcrypt.compare(password, user.password).then((result, err) => {
                if (err) {
                    return res.status(500).send(err);
                }
                if (!result) {
                    req.flash('error', 'Incorrect email address or password.');
                    return res.redirect('/login');
                }
                if (!user.validated) {
                    req.flash(
                        'error',
                        'Please validate your email address to log in. If you have not received a validation email, please check your spam folder or <a href="/resend-validation">click here</a> to resend the validation email.',
                    );
                    return res.redirect('/login');
                }
                req.session.loggedIn = true;
                req.session.user = {
                    emailAddress: user.emailAddress,
                    id: user.id,
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
            if (user) {
                req.flash(
                    'error',
                    'This email address is already in use. Try logging in.',
                );
                return res.redirect('/register');
            }
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(password, salt);
            const validationToken = crypto.randomBytes(16).toString('hex');
            sequelize.models.User.create({
                emailAddress,
                password: hashedPassword,
                salt,
                validationToken,
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
        return res.redirect('/reset-password');
    }
    if (password.length < 8) {
        req.flash('error', 'Password must be at least 8 characters long.');
        return res.redirect('/reset-password');
    }
    if (password.length > 72) {
        req.flash('error', 'Password must be less than 72 characters long.');
        return res.redirect('/reset-password');
    }
    sequelize.models.User.findOne({ where: { resetToken } })
        .then((user) => {
            if (!user) {
                req.flash('error', 'Invalid password reset token.');
                return res.redirect('/reset-password');
            }
            if (user.resetTokenExpiry < Date.now()) {
                req.flash('error', 'Password reset token has expired.');
                return res.redirect('/reset-password');
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
                    return res.redirect('/reset-password');
                });
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error resetting your password. Please try again.',
            );
            return res.redirect('/reset-password');
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

export { api, frontend, auth };
