import request from 'supertest';
import dotenv from 'dotenv';
import app from '../app.js';
import sequelize from '../lib/database.js';

dotenv.config();

describe('POST /auth/register', () => {
    it('should redirect to /register on success', async () => {
        const res = await request(app).post('/auth/register').send({
            emailAddress: 'foo@example.com',
            password: 'password',
            names: 'test, name',
        });
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toEqual('/register');
    });
    it('should show a flash message', async () => {
        const res = await request(app).post('/auth/register').send({
            emailAddress: 'foo@example.com',
            password: '',
            names: 'test, name',
        });
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toEqual('/register');

    });
});