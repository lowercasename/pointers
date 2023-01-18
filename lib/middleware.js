import sequelize from './database.js';
import { Op } from 'sequelize';

const redirectIfNotLoggedIn = (req, res, next) => {
    if (!req.session.loggedIn) {
        req.flash('error', 'You must be logged in to access this page.');
        return res.redirect('/login');
    }
    sequelize.models.User.findOne({
        where: { emailAddress: req.session.user.emailAddress },
        attributes: [
            'id',
            'emailAddress',
            'bio',
            'avatar',
            'pointerAccessDuration',
        ],
    })
        .then((user) => {
            if (!user) {
                req.flash(
                    'error',
                    'You must be logged in to access this page.',
                );
                return res.redirect('/login');
            }
            next();
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error processing your request. Please try again.',
            );
            return res.redirect('/login');
        });
};

const deleteExpiredPointerKeys = async (req, res, next) => {
    const expiredAccessRequests = await sequelize.models.AccessRequest.findAll({
        where: {
            expiry: { [Op.lt]: new Date() },
        },
        include: [sequelize.models.PointerKey],
    });
    for (const accessRequest of expiredAccessRequests) {
        for (const pointerKey of accessRequest.PointerKeys) {
            await pointerKey.destroy();
        }
    }
    next();
};

export { redirectIfNotLoggedIn, deleteExpiredPointerKeys };
