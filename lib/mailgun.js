import dotenv from 'dotenv';
import Mailgun from 'mailgun-js';
dotenv.config();

const mailgun = Mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
});

export default mailgun;
