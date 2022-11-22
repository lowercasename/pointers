import { DataTypes } from 'sequelize';

export default (sequelize) => {
    sequelize.define('Pointer', {
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        tags: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '',
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
