import sequelize from './database.js';

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
            res.locals.user = user;
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

export { redirectIfNotLoggedIn };
