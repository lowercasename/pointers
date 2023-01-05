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
        // Change type of title, url, description, tags, image and icon to TEXT
        await queryInterface.changeColumn('Pointers', 'title', {
            type: Sequelize.TEXT,
        });
        await queryInterface.changeColumn('Pointers', 'url', {
            type: Sequelize.TEXT,
        });
        await queryInterface.changeColumn('Pointers', 'description', {
            type: Sequelize.TEXT,
        });
        await queryInterface.changeColumn('Pointers', 'tags', {
            type: Sequelize.TEXT,
        });
        await queryInterface.changeColumn('Pointers', 'image', {
            type: Sequelize.TEXT,
        });
        await queryInterface.changeColumn('Pointers', 'icon', {
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
        // Change type of title, url, description, tags, image and icon to STRING
        await queryInterface.changeColumn('Pointers', 'title', {
            type: Sequelize.STRING,
        });
        await queryInterface.changeColumn('Pointers', 'url', {
            type: Sequelize.STRING,
        });
        await queryInterface.changeColumn('Pointers', 'description', {
            type: Sequelize.STRING,
        });
        await queryInterface.changeColumn('Pointers', 'tags', {
            type: Sequelize.STRING,
        });
        await queryInterface.changeColumn('Pointers', 'image', {
            type: Sequelize.STRING,
        });
        await queryInterface.changeColumn('Pointers', 'icon', {
            type: Sequelize.STRING,
        });
    },
};
