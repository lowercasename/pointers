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
        // Change unique constraint on emailAddress column from true to 'emailAddress'
        await queryInterface.changeColumn('Users', 'emailAddress', {
            type: Sequelize.STRING,
            allowNull: false,
            unique: 'emailAddress',
        });
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         *
         * Example:
         * await queryInterface.dropTable('users');
         */
        // Change unique constraint on emailAddress column from 'emailAddress' to true
        await queryInterface.changeColumn('Users', 'emailAddress', {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
        });
    },
};
