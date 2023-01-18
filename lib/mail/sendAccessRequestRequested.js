import sequelize from '../database.js';
import mailgun from '../mailgun.js';

// Send an email to the requestee to let them know that an access request has been requested.
const sendAccessRequestRequested = async (
    requester,
    requestee,
    accessRequest,
) => {
    const mainName = await sequelize.models.UserName.findOne({
        where: { main: true, UserId: requester.id },
        attributes: ['name'],
    });
    mailgun.messages().send(
        {
            from: 'noreply@pointers.website',
            to: requestee.emailAddress,
            subject: 'New Pointers access request',
            text: `
Hi!

${mainName.name} has requested access to your pointers.
Their message is:
${accessRequest.message}
You can accept or reject this request at https://pointers.website/profile.

Thanks for using Pointers!
        `,
        },
        (error) => {
            if (error) {
                console.log(error);
                return error;
            }
        },
    );
};

export default sendAccessRequestRequested;
