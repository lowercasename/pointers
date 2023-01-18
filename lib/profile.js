import { Op } from 'sequelize';
import sequelize from './database.js';
import mailgun from './mailgun.js';
import crypto from 'crypto';

const updateProfile = async (req, res) => {
    const { emailAddress, bio, pointerAccessDuration } = req.body;
    if (!emailAddress) {
        req.flash('error', 'Please fill out the email address.');
        return res.redirect('/profile/edit');
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
    if (bio.length > 500) {
        req.flash('error', 'Bio must be less than 500 characters long.');
        return res.redirect('/profile/edit');
    }
    if (pointerAccessDuration < 1 || pointerAccessDuration > 30) {
        req.flash(
            'error',
            'Pointer access duration must be between 1 and 30 days.',
        );
        return res.redirect('/profile/edit');
    }
    sequelize.models.User.findOne({
        where: { emailAddress: res.locals.user.emailAddress },
    })
        .then((user) => {
            if (!user) {
                req.flash(
                    'error',
                    'There was an error updating your profile. Please try again.',
                );
                return res.redirect('/profile/edit');
            }
            // Update bio and pointer access duration first
            user.bio = bio.trim();
            user.pointerAccessDuration = pointerAccessDuration;
            user.save()
                .then(async () => {
                    // Then update email address, if it has changed
                    if (user.emailAddress !== emailAddress) {
                        // Check if the email address is already in use.
                        const existingUser =
                            await sequelize.models.User.findOne({
                                where: { emailAddress },
                            });
                        if (existingUser) {
                            req.flash(
                                'error',
                                'This email address is already in use.',
                            );
                            return res.redirect('/profile/edit');
                        }
                        const validationToken = crypto
                            .randomBytes(16)
                            .toString('hex');
                        user.emailAddress = emailAddress;
                        user.validated = false;
                        user.validationToken = validationToken;
                        user.save()
                            .then(() => {
                                mailgun.messages().send(
                                    {
                                        from: 'noreply@pointers.website',
                                        to: emailAddress,
                                        subject:
                                            'Please validate your email address',
                                        text: `Please click the following link to validate your email address: https://pointers.website/validate/${validationToken}`,
                                    },
                                    (error) => {
                                        if (error) {
                                            console.log(error);
                                            req.flash(
                                                'error',
                                                'There was an error sending the validation email. Please try again.',
                                            );
                                            return res.redirect(
                                                '/profile/edit',
                                            );
                                        } else {
                                            req.session.destroy(() => {
                                                return res.redirect('/login');
                                            });
                                        }
                                    },
                                );
                            })
                            .catch((err) => {
                                console.log(err);
                                req.flash(
                                    'error',
                                    'There was an error updating your profile. Please try again.',
                                );
                                return res.redirect('/profile/edit');
                            });
                    } else {
                        return res.redirect('/profile');
                    }
                })
                .catch((err) => {
                    console.log(err);
                    req.flash(
                        'error',
                        'There was an error updating your profile. Please try again.',
                    );
                    return res.redirect('/profile/edit');
                });
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error updating your profile. Please try again.',
            );
            return res.redirect('/profile/edit');
        });
};

const deleteProfile = async (req, res) => {
    // Delete all pointer keys associated with the user
    await sequelize.models.PointerKey.destroy({
        where: { UserId: res.locals.user.id },
    });
    // Delete all pointers associated with the user
    await sequelize.models.Pointer.destroy({
        where: { UserId: res.locals.user.id },
    });
    // Delete all access requests associated with the user
    await sequelize.models.AccessRequest.destroy({
        where: {
            [Op.or]: [
                { requesterId: res.locals.user.id },
                { requesteeId: res.locals.user.id },
            ],
        },
    });
    // Delete all user names associated with the user
    await sequelize.models.UserName.destroy({
        where: { UserId: res.locals.user.id },
    });
    sequelize.models.User.destroy({ where: { id: res.locals.user.id } })
        .then(() => {
            req.session.destroy(() => {
                return res.redirect('/login');
            });
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error deleting your account. Please try again.',
            );
            return res.redirect('/profile/edit');
        });
};

export { updateProfile, deleteProfile };
