import sequelize from './database.js';

const createName = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        req.flash('error', 'Please fill out the name.');
        return res.redirect('/profile');
    }
    if (name.length < 3 || name.length > 80) {
        req.flash(
            'error',
            'Please enter a name between 3 and 80 characters long.',
        );
        return res.redirect('/profile');
    }
    const names = await sequelize.models.UserName.findAll({
        where: { UserId: res.locals.user.id },
    });
    sequelize.models.UserName.create({
        name: name.trim(),
        UserId: res.locals.user.id,
        main: names.length === 0,
    })
        .then(() => {
            return res.redirect('/profile');
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error creating your name. Please try again.',
            );
            return res.redirect('/profile');
        });
};

const deleteName = async (req, res) => {
    const { hash } = req.params;
    if (!hash) {
        req.flash(
            'error',
            'There was an error deleting your name. Please try again.',
        );
        return res.redirect('/profile');
    }
    const name = await sequelize.models.UserName.findOne({ where: { hash } });
    if (name.UserId !== res.locals.user.id) {
        req.flash('error', 'You do not have permission to delete this name.');
        return res.redirect('/profile');
    }
    const names = await sequelize.models.UserName.findAll({
        where: { UserId: res.locals.user.id },
    });
    if (names.length === 1) {
        req.flash('error', 'You must have at least one name.');
        return res.redirect('/profile');
    }
    name.destroy()
        .then(() => {
            return res.redirect('/profile');
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error deleting your name. Please try again.',
            );
            return res.redirect('/profile');
        });
};

const setNameAsMain = async (req, res) => {
    const { hash } = req.params;
    if (!hash) {
        req.flash(
            'error',
            'There was an error editing this name. Please try again.',
        );
        return res.redirect('/profile');
    }
    await sequelize.models.UserName.update(
        { main: false },
        { where: { UserId: res.locals.user.id } },
    );
    sequelize.models.UserName.findOne({ where: { hash } }).then((name) => {
        if (name.UserId !== res.locals.user.id) {
            req.flash('error', 'You do not have permission to edit this name.');
            return res.redirect('/profile');
        }
        name.main = true;
        name.save()
            .then(() => {
                return res.redirect('/profile');
            })
            .catch((err) => {
                console.log(err);
                req.flash(
                    'error',
                    'There was an error editing this name. Please try again.',
                );
                return res.redirect('/profile');
            });
    });
};

export { createName, deleteName, setNameAsMain };
