import { DataTypes } from 'sequelize';

export default function (sequelize) {
    sequelize.define('UserName', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        public: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        main: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        hash: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: false,
            defaultValue: '',
        },
    });
}
