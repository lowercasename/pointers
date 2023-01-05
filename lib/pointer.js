import sequelize from './database.js';
import scrapeMetadata from './metadata.js';
import { validateUrl } from './validation.js';
import { encrypt, decrypt, encryptRsa, generateKey } from './encryption.js';

const createPointer = async (req, res) => {
    const { title, description, url } = req.body;
    if (!title || !url) {
        req.flash('error', 'Please fill out the pointer title and URL.');
        return res.redirect('/profile');
    }
    // Validate URL
    if (validateUrl(url) === false) {
        req.flash('error', 'Please enter a valid URL.');
        return res.redirect('/profile');
    }
    if (title.length < 3 || title.length > 80) {
        req.flash(
            'error',
            'Please enter a title between 3 and 80 characters long.',
        );
        return res.redirect('/profile');
    }
    if (description.length > 255) {
        req.flash(
            'error',
            'Please enter a description less than 255 characters long.',
        );
        return res.redirect('/profile');
    }
    if (url.length > 255) {
        req.flash('error', 'Please enter a URL less than 255 characters long.');
        return res.redirect('/profile');
    }
    // Attempt to get the metadata for the URL
    const metadata = await scrapeMetadata(url.trim());
    // Discard icon and image if they're too long (which can happen if the icon
    // is a data URI)
    if (metadata.icon?.length > 4096) {
        metadata.icon = undefined;
    }
    if (metadata.image?.length > 4096) {
        metadata.image = undefined;
    }

    // Assemble and encrypt the pointer data
    const pointerData = {
        title: title.trim(),
        description: description.trim(),
        url: url.trim(),
        icon: metadata.icon,
        image: metadata.image,
    };
    const { encryptedData, pointerKey } = encryptPointerData(pointerData);

    // Create the pointer
    sequelize.models.Pointer.create({
        data: encryptedData,
        UserId: res.locals.user.id,
    })
        .then((pointer) => {
            // Encrypt the pointer key with the user's public key
            const encryptedKey = encryptRsa(
                pointerKey,
                res.locals.user.publicKey,
            );
            // Save the encrypted pointer key
            sequelize.models.PointerKey.create({
                UserId: res.locals.user.id,
                PointerId: pointer.id,
                encryptedKey,
            })
                .then(() => {
                    return res.redirect('/profile');
                })
                .catch((err) => {
                    console.log(err);
                    req.flash(
                        'error',
                        'There was an error creating your pointer. Please try again.',
                    );
                    return res.redirect('/profile');
                });
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error creating your pointer. Please try again.',
            );
            return res.redirect('/profile');
        });
};

const updatePointer = async (req, res) => {
    const { title, description, url, hash } = req.body;
    if (!title || !url || !hash) {
        req.flash('error', 'Please fill out the pointer title and URL.');
        return res.redirect('/profile');
    }
    const pointer = await sequelize.models.Pointer.findOne({ where: { hash } });
    if (!pointer || pointer.UserId !== res.locals.user.id) {
        req.flash('error', 'You do not have permission to edit this pointer.');
        return res.redirect('/profile');
    }
    // Validate URL
    if (validateUrl(url) === false) {
        req.flash('error', 'Please enter a valid URL.');
        return res.redirect(`/pointer/${hash}/edit`);
    }
    if (title.length < 3 || title.length > 80) {
        req.flash(
            'error',
            'Please enter a title between 3 and 80 characters long.',
        );
        return res.redirect('/profile');
    }
    if (description.length > 255) {
        req.flash(
            'error',
            'Please enter a description less than 255 characters long.',
        );
        return res.redirect('/profile');
    }
    if (url.length > 255) {
        req.flash('error', 'Please enter a URL less than 255 characters long.');
        return res.redirect('/profile');
    }
    pointer.title = title;
    pointer.description = description;
    pointer.url = url;
    pointer
        .save()
        .then(() => {
            return res.redirect(`/profile`);
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error editing your pointer. Please try again.',
            );
            return res.redirect(`/pointer/${hash}/edit`);
        });
};

const deletePointer = async (req, res) => {
    const { hash } = req.params;
    if (!hash) {
        req.flash(
            'error',
            'There was an error deleting your pointer. Please try again.',
        );
        return res.redirect('/profile');
    }
    const pointer = await sequelize.models.Pointer.findOne({ where: { hash } });
    if (!pointer || pointer.UserId !== res.locals.user.id) {
        req.flash(
            'error',
            'You do not have permission to delete this pointer.',
        );
        return res.redirect('/profile');
    }
    pointer
        .destroy()
        .then(() => {
            return res.redirect('/profile');
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error deleting your pointer. Please try again.',
            );
            return res.redirect('/profile');
        });
};

const updatePointerIcon = async (req, res) => {
    const { hash } = req.params;
    if (!hash) {
        req.flash(
            'error',
            'There was an error updating your pointer icon. Please try again.',
        );
        return res.redirect('/profile');
    }
    const pointer = await sequelize.models.Pointer.findOne({ where: { hash } });
    if (!pointer || pointer.UserId !== res.locals.user.id) {
        req.flash(
            'error',
            'You do not have permission to update this pointer icon.',
        );
        return res.redirect('/profile');
    }
    const metadata = await scrapeMetadata(pointer.url);
    console.log(metadata);
    pointer.icon = metadata.icon;
    pointer
        .save()
        .then(() => {
            return res.redirect(`/profile`);
        })
        .catch((err) => {
            console.log(err);
            req.flash(
                'error',
                'There was an error updating your pointer icon. Please try again.',
            );
            return res.redirect('/profile');
        });
};

const encryptPointerData = async (pointerData, pointerKey) => {
    pointerData = JSON.stringify(pointerData);
    // If a pointer key is not provided, generate one
    if (!pointerKey) {
        pointerKey = generateKey();
    }
    // Encrypt the pointer data
    const encryptedData = encrypt(pointerData, pointerKey);
    return { encryptedData, pointerKey };
};

const decryptPointerData = async (encryptedData, pointerKey) => {
    // Decrypt the pointer data
    const pointerData = decrypt(encryptedData, pointerKey);
    return JSON.parse(pointerData);
};

export {
    createPointer,
    updatePointer,
    deletePointer,
    updatePointerIcon,
    encryptPointerData,
    decryptPointerData,
};
