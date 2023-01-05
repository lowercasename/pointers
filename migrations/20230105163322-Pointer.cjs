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
        // // Remove title, url, description, tags, icon, image, and encryptedKey columns from Pointers table
        // await queryInterface.removeColumn('Pointers', 'title');
        // await queryInterface.removeColumn('Pointers', 'url');
        // await queryInterface.removeColumn('Pointers', 'description');
        // await queryInterface.removeColumn('Pointers', 'tags');
        // await queryInterface.removeColumn('Pointers', 'icon');
        // await queryInterface.removeColumn('Pointers', 'image');
        await queryInterface.removeColumn('Pointers', 'encryptedKey');

        // Add data column to Pointers table
        await queryInterface.addColumn('Pointers', 'data', {
            type: Sequelize.TEXT,
            allowNull: false,
        });

        // Move data fields from Pointers table to data column
        const pointers = await queryInterface.sequelize.query(
            'SELECT id, title, url, description, tags, icon, image, encryptedKey FROM Pointers',
            { type: queryInterface.sequelize.QueryTypes.SELECT },
        );
        for (const pointer of pointers) {
            const data = {
                title: pointer.title,
                url: pointer.url,
                description: pointer.description,
                tags: pointer.tags,
                icon: pointer.icon,
                image: pointer.image,
            };
            await queryInterface.sequelize.query(
                'UPDATE Pointers SET data = :data WHERE id = :id',
                {
                    replacements: {
                        data: JSON.stringify(data),
                        id: pointer.id,
                    },
                },
            );
        }
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add reverting commands here.
         *
         * Example:
         * await queryInterface.dropTable('users');
         */
        // // Add title, url, description, tags, icon, image, and encryptedKey columns to Pointers table
        // await queryInterface.addColumn('Pointers', 'title', {
        //     type: Sequelize.STRING,
        //     allowNull: false,
        // });
        // await queryInterface.addColumn('Pointers', 'url', {
        //     type: Sequelize.STRING,
        //     allowNull: false,
        // });
        // await queryInterface.addColumn('Pointers', 'description', {
        //     type: Sequelize.STRING,
        //     allowNull: true,
        // });
        // await queryInterface.addColumn('Pointers', 'tags', {
        //     type: Sequelize.STRING,
        //     allowNull: true,
        //     defaultValue: '',
        // });
        // await queryInterface.addColumn('Pointers', 'icon', {
        //     type: Sequelize.STRING,
        //     allowNull: true,
        //     defaultValue: '',
        // });
        // await queryInterface.addColumn('Pointers', 'image', {
        //     type: Sequelize.STRING,
        //     allowNull: true,
        //     defaultValue: '',
        // });
        await queryInterface.addColumn('Pointers', 'encryptedKey', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: '',
        });
        // Remove data column from Pointers table
        await queryInterface.removeColumn('Pointers', 'data');
    },
};
