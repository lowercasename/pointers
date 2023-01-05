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
        // Add encryptedKey to User
        await queryInterface.addColumn('Users', 'encryptedKey', {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: '',
        });
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         *
         * Example:
         * await queryInterface.dropTable('users');
         */
        // Remove encryptedKey from User
        await queryInterface.removeColumn('Users', 'encryptedKey');
    },
};
