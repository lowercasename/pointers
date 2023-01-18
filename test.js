import crypto from 'crypto';

// const iv = crypto.randomBytes(16);
// let key = crypto.randomBytes(32);

const encrypt = (text, key) => {
    const iv = crypto.randomBytes(16);
    // Convert supplied key from a base64 string to a buffer
    key = Buffer.from(key, 'base64');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted =
        cipher.update(text, 'utf8', 'base64') + cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
};

const decrypt = (text, key) => {
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

const key = crypto.randomBytes(32).toString('base64');
const s =
    'Hello, world! This is a test of the emergency broadcast system. This is only a test. If this had been an actual emergency, you would have been instructed to do something.';

const enc = encrypt(s, key);
const dec = decrypt(enc, key);

console.log(s.length);
console.log('Encrypted:', enc);
console.log(enc.length);
console.log('Decrypted:', dec);
