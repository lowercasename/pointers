import { DataTypes } from 'sequelize';

export default function (sequelize) {
    sequelize.define('User', {
        emailAddress: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: 'emailAddress',
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        salt: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        validated: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        validationToken: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        validationTokenExpiry: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        resetToken: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        resetTokenExpiry: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        bio: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        avatar: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        // The number of days that a user has access to another user's pointers
        pointerAccessDuration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 7,
        },
        hash: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '',
        },
        encryptedKey: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '',
        },
        publicKey: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: '',
        },
        privateKey: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: '',
        },
    });
}
