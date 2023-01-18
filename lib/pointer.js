import sequelize from './database.js';
import scrapeMetadata from './metadata.js';
import { validateUrl } from './validation.js';
import {
    encrypt,
    decrypt,
    encryptRsa,
    decryptRsa,
    generateKey,
} from './encryption.js';

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
    // Discard icon and image if they're too long
    // (which can happen if the icon is a data URI)
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
    // Fetch the user's public key
    const { publicKey } = await sequelize.models.User.findOne({
        where: { id: res.locals.user.id },
        attributes: ['publicKey'],
        raw: true,
    });
    if (!publicKey) {
        req.flash(
            'error',
            'There was an error creating your pointer. Please try again.',
        );
        return res.redirect('/profile');
    }
    try {
        const { encryptedData, pointerKey } = encryptPointerData(pointerData);
        // Create the pointer
        const pointer = await sequelize.models.Pointer.create({
            data: encryptedData,
            UserId: res.locals.user.id,
        });
        // Encrypt the pointer key with the user's public key
        const encryptedKey = encryptRsa(pointerKey, publicKey);
        // Save the encrypted pointer key
        await sequelize.models.PointerKey.create({
            UserId: res.locals.user.id,
            PointerId: pointer.id,
            encryptedKey,
        });
        return res.redirect('/profile');
    } catch (err) {
        console.log(err);
        req.flash(
            'error',
            'There was an error creating your pointer. Please try again.',
        );
        return res.redirect('/profile');
    }
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
    // Assemble and encrypt the pointer data
    try {
        const oldData = await decryptPointer(
            pointer.hash,
            req.session.user.id,
            req.session.user.key,
        );
        const newData = {
            title: title.trim(),
            description: description.trim(),
            url: url.trim(),
            icon: oldData.icon,
            image: oldData.image,
        };
        // Now, encrypt the new pointer data with the old pointer key
        const encryptedData = await encryptPointer(
            newData,
            pointer.id,
            req.session.user.id,
            req.session.user.key,
        );
        pointer.data = encryptedData;
        await pointer.save();
        return res.redirect(`/profile`);
    } catch (err) {
        console.log(err);
        req.flash(
            'error',
            'There was an error editing your pointer. Please try again.',
        );
        return res.redirect(`/pointer/${hash}/edit`);
    }
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
    // Delete all pointer keys for this pointer
    sequelize.models.PointerKey.destroy({
        where: { PointerId: pointer.id },
    });
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
    try {
        const pointerData = await decryptPointer(
            pointer.hash,
            req.session.user.id,
            req.session.user.key,
        );
        const metadata = await scrapeMetadata(pointerData.url?.trim());
        // Discard icon and image if they're too long
        // (which can happen if the icon is a data URI)
        if (metadata.icon?.length > 4096) {
            metadata.icon = undefined;
        }
        if (metadata.image?.length > 4096) {
            metadata.image = undefined;
        }
        pointerData.icon = metadata.icon;
        const encryptedData = await encryptPointer(
            pointerData,
            pointer.id,
            req.session.user.id,
            req.session.user.key,
        );
        pointer.data = encryptedData;
        await pointer.save();
        return res.redirect(`/profile`);
    } catch (err) {
        console.log(err);
        req.flash(
            'error',
            'There was an error updating your pointer icon. Please try again.',
        );
        return res.redirect(`/pointer/${hash}/edit`);
    }
};

const encryptPointerData = (pointerData, pointerKey) => {
    pointerData = JSON.stringify(pointerData);
    // If a pointer key is not provided, generate one
    if (!pointerKey) {
        pointerKey = generateKey();
    }
    // Encrypt the pointer data
    const encryptedData = encrypt(pointerData, pointerKey);
    return { encryptedData, pointerKey };
};

const decryptPointerData = (encryptedData, pointerKey) => {
    // Decrypt the pointer data
    const pointerData = decrypt(encryptedData, pointerKey);
    return JSON.parse(pointerData);
};

const decryptPointer = async (pointerHash, userId, passwordDerivedKey) => {
    // Fetch the pointer
    const pointer = await sequelize.models.Pointer.findOne({
        where: { hash: pointerHash },
    });
    if (!pointer) {
        return null;
    }
    // Attempt to parse the pointer data as JSON
    // (This is in case we access a non-encrypted pointer)
    try {
        const unencryptedPointerData = JSON.parse(pointer.data);
        return unencryptedPointerData;
    } catch (e) {
        // Fetch the user
        const user = await sequelize.models.User.findOne({
            where: { id: userId },
        });
        if (!user) {
            return null;
        }
        // Fetch the pointer key
        const pointerKey = await sequelize.models.PointerKey.findOne({
            where: { PointerId: pointer.id, UserId: user.id },
            attributes: ['encryptedKey'],
            raw: true,
        });
        if (!pointerKey) {
            return null;
        }
        const { encryptedKey } = pointerKey;
        if (!encryptedKey) {
            return null;
        }
        try {
            // Decrypt the pointer key
            const privateKey = await user.getPrivateKey(passwordDerivedKey);
            const pointerKey = decryptRsa(encryptedKey, privateKey);
            // Decrypt the pointer data
            const pointerData = decryptPointerData(pointer.data, pointerKey);
            return pointerData;
        } catch (err) {
            console.log(err);
            return null;
        }
    }
};

const encryptPointer = async (
    pointerData,
    pointerId,
    userId,
    passwordDerivedKey,
) => {
    // Fetch the user
    const user = await sequelize.models.User.findOne({
        where: { id: userId },
    });
    if (!user) {
        return null;
    }
    // Fetch the pointer key
    const pointerKey = await sequelize.models.PointerKey.findOne({
        where: { PointerId: pointerId, UserId: user.id },
        attributes: ['encryptedKey'],
        raw: true,
    });
    if (!pointerKey) {
        return null;
    }
    const { encryptedKey } = pointerKey;
    if (!encryptedKey) {
        return null;
    }
    try {
        // Decrypt the pointer key
        const privateKey = await user.getPrivateKey(passwordDerivedKey);
        const pointerKey = decryptRsa(encryptedKey, privateKey);
        // Encrypt the new pointer data
        const { encryptedData } = encryptPointerData(pointerData, pointerKey);
        return encryptedData;
    } catch (err) {
        console.log(err);
        return null;
    }
};

export {
    createPointer,
    updatePointer,
    deletePointer,
    updatePointerIcon,
    encryptPointerData,
    decryptPointerData,
    decryptPointer,
    encryptPointer,
};
