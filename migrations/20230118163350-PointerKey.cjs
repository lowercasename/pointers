'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        /**
         * Add altering commands here.
         *
         * Example:
         * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
         */
        // Create PointerKey table
        await queryInterface.createTable('PointerKeys', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            encryptedKey: {
                type: Sequelize.TEXT,
                allowNull: true,
                defaultValue: '',
            },
            AccessRequestId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'AccessRequests',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
        });
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         *
         * Example:
         * await queryInterface.dropTable('users');
         */
        // Drop PointerKeys table
        await queryInterface.dropTable('PointerKeys');
    },
};
