import { DataTypes } from 'sequelize';

export default (sequelize) => {
    sequelize.define('Block', {
        blockedUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        hash: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
            defaultValue: '',
        },
    });
};
