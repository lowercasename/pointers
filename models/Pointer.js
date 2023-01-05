import { DataTypes } from 'sequelize';

export default (sequelize) => {
    sequelize.define('Pointer', {
        data: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        public: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        archived: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        archivedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        hash: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '',
        },
    });
};
