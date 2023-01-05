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
        // Add encryptedKey column to Pointers table
        await queryInterface.addColumn('Pointers', 'encryptedKey', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: '',
        });
    },

    async down(queryInterface) {
        /**
         * Add reverting commands here.
         *
         * Example:
         * await queryInterface.dropTable('users');
         */
        // Remove encryptedKey column from Pointers table
        await queryInterface.removeColumn('Pointers', 'encryptedKey');
    },
};
