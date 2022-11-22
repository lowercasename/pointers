import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import * as Eta from 'eta';
import { api, frontend, auth } from './router.js';
import * as dotenv from 'dotenv';
dotenv.config();
import sequelize from './lib/database.js';
import sequelizeSession from 'connect-session-sequelize';

const app = express();

app.engine('eta', Eta.renderFile);
app.set('view engine', 'eta');
app.set('views', './views');

const SequelizeStore = sequelizeSession(session.Store);
const sessionStore = new SequelizeStore({
    db: sequelize,
    expiration: 1000 * 60 * 60 * 24 * 7,
});
app.use(
    session({
        name: 'session',
        saveUninitialized: true,
        resave: false,
        secret: 'secret',
        store: sessionStore,
    }),
);
app.use(flash());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static('public'));

app.use((req, res, next) => {
    if (req.session.loggedIn) {
        res.locals.loggedIn = true;
        res.locals.user = req.session.user;
    }
    next();
});

app.use('/', frontend);
app.use('/api', api);
app.use('/auth', auth);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
