import { Op } from 'sequelize';
import sequelize from './database.js';

const searchUsers = async (q) => {
    if (!q) {
        return [];
    }
    if (q.length < 3) {
        return [];
    }
    const host = new URL(process.env.DOMAIN).host;
    const userNames = await sequelize.models.UserName.findAll({
        where: {
            name: {
                [Op.substring]: q,
            },
        },
        include: {
            model: sequelize.models.User,
            attributes: ['id', 'hash'],
        },
        raw: true,
        nest: true,
    });
    const users = userNames.reduce((acc, curr) => {
        if (!curr.User?.id) {
            return acc;
        }
        if (!acc.find((user) => user.id === curr.User.id)) {
            acc.push({
                ...curr.User,
                names: [
                    {
                        name: curr.name,
                        main: Boolean(curr.main),
                        absolute: `${curr.name}@${host}`,
                    },
                ],
            });
        } else {
            acc.find((user) => user.id === curr.User.id).names.push({
                name: curr.name,
                main: curr.main,
                absolute: `${curr.name}@${host}`,
            });
        }
        return acc;
    }, []);
    users.forEach((user) => {
        user.names.sort((a, b) => {
            if (a.main && !b.main) {
                return -1;
            } else if (!a.main && b.main) {
                return 1;
            } else {
                return 0;
            }
        });
        // Add the URL to the user's profile
        user.url = `${process.env.DOMAIN}/u/${user.hash}`;
        user.host = process.env.DOMAIN;
    });

    return users;
};

export { searchUsers };
