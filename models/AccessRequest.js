import { DataTypes } from 'sequelize';

export default (sequelize) => {
    sequelize.define('AccessRequest', {
        expiry: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: new Date(),
        },
        pending: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        accepted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        message: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        hash: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '',
        },
    });
};
