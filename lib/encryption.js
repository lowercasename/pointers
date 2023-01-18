import crypto from 'crypto';

export const generateKeyPair = () => {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'pkcs1',
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs1',
            format: 'pem',
        },
    });
};

export const generateKey = () => {
    return crypto.randomBytes(32).toString('base64');
};

export const deriveKey = (password, salt) => {
    return crypto
        .pbkdf2Sync(password, salt, 200000, 32, 'sha512')
        .toString('base64');
};

export const encrypt = (text, key) => {
    const iv = crypto.randomBytes(16);
    // Convert supplied key from a base64 string to a buffer
    key = Buffer.from(key, 'base64');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted =
        cipher.update(text, 'utf8', 'base64') + cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
};

export const decrypt = (text, key) => {
    // Convert supplied key from a base64 string to a buffer
    key = Buffer.from(key, 'base64');
    const textParts = text.split(':');
    const iv = Buffer.from(textParts[0], 'base64');
    const encryptedText = Buffer.from(textParts[1], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted =
        decipher.update(encryptedText, 'base64', 'utf8') + decipher.final();
    return decrypted.toString();
};

export const encryptRsa = (text, publicKey) => {
    const buffer = Buffer.from(text, 'utf8');
    return crypto.publicEncrypt(publicKey, buffer).toString('base64');
};

export const decryptRsa = (text, privateKey) => {
    const buffer = Buffer.from(text, 'base64');
    return crypto.privateDecrypt(privateKey, buffer).toString('utf8');
};
