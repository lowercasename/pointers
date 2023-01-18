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
        // Add publicKey and privateKey columns to Users table
        await queryInterface.addColumn('Users', 'publicKey', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: '',
        });
        await queryInterface.addColumn('Users', 'privateKey', {
            type: Sequelize.TEXT,
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
        // Remove publicKey and privateKey columns from Users table
        await queryInterface.removeColumn('Users', 'publicKey');
        await queryInterface.removeColumn('Users', 'privateKey');
    },
};
