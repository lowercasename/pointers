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
        // Change encryptedKey type to TEXT
        await queryInterface.changeColumn('Users', 'encryptedKey', {
            type: Sequelize.TEXT,
        });
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         *
         * Example:
         * await queryInterface.dropTable('users');
         */
        // Change encryptedKey type to STRING
        await queryInterface.changeColumn('Users', 'encryptedKey', {
            type: Sequelize.STRING,
        });
    },
};
