import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';
import Hashids from 'hashids';
import User from '../models/User.js';
import AccessRequest from '../models/AccessRequest.js';
import Pointer from '../models/Pointer.js';
import UserName from '../models/UserName.js';
dotenv.config();

const sequelize = new Sequelize(
    {
	database: 'pointers',
	username: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	host: '127.0.0.1',
	dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
    },
);

// Define the models
User(sequelize);
AccessRequest(sequelize);
Pointer(sequelize);
UserName(sequelize);

// Make associations
sequelize.models.User.hasMany(sequelize.models.Pointer);
sequelize.models.Pointer.belongsTo(sequelize.models.User);
sequelize.models.User.hasMany(sequelize.models.UserName);
sequelize.models.UserName.belongsTo(sequelize.models.User);
sequelize.models.AccessRequest.hasOne(sequelize.models.User, {
    as: 'requester',
    foreignKey: 'requesterId',
});
sequelize.models.AccessRequest.hasOne(sequelize.models.User, {
    as: 'requestee',
    foreignKey: 'requesteeId',
});
sequelize.models.User.hasMany(sequelize.models.AccessRequest, {
    as: 'requester',
    foreignKey: 'requesterId',
});
sequelize.models.User.hasMany(sequelize.models.AccessRequest, {
    as: 'requestee',
    foreignKey: 'requesteeId',
});

// Hooks
sequelize.models.Pointer.afterCreate(async (pointer) => {
    const user = await sequelize.models.User.findOne({
        where: { id: pointer.UserId },
    });
    const hashids = new Hashids(user.emailAddress, 8);
    const hash = hashids.encode(pointer.id);
    pointer.hash = hash;
    await pointer.save();
});
sequelize.models.User.afterCreate(async (user) => {
    const hashids = new Hashids(user.emailAddress, 8);
    const hash = hashids.encode(user.id);
    user.hash = hash;
    await user.save();
});
sequelize.models.AccessRequest.afterCreate(async (accessRequest) => {
    const user = await sequelize.models.User.findOne({
        where: { id: accessRequest.requesteeId },
    });
    const hashids = new Hashids(user.emailAddress, 8);
    const hash = hashids.encode(accessRequest.id);
    accessRequest.hash = hash;
    await accessRequest.save();
});
sequelize.models.UserName.afterCreate(async (userName) => {
    const user = await sequelize.models.User.findOne({
        where: { id: userName.UserId },
    });
    const hashids = new Hashids(user.emailAddress, 8);
    const hash = hashids.encode(userName.id);
    userName.hash = hash;
    await userName.save();
});

try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}

//await sequelize.sync();

export default sequelize;
