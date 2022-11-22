import mailgun from '../mailgun.js';

// Send an email to the requester to let them know that their access request has been accepted.
const sendAccessRequestAccepted = async (
    requester,
    requestee,
    accessRequest,
) => {
    const mainName = await requestee.getUserNames({
        where: { main: true },
        limit: 1,
        raw: true,
    });
    mailgun.messages().send(
        {
            from: 'noreply@pointers.website',
            to: requester.emailAddress,
            subject: 'Pointers access request accepted',
            text: `
Hi!

Your access request to ${mainName[0].name} has been accepted.
You can now view their pointers at https://pointers.website/u/${requestee.hash}.
This access will expire in ${requestee.pointerAccessDuration} days.

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

export default sendAccessRequestAccepted;
