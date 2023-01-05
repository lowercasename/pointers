import { DataTypes } from 'sequelize';

export default (sequelize) => {
    sequelize.define('PointerKey', {
        encryptedKey: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: '',
        },
    });
};
