import * as cheerio from 'cheerio';

const validateUrl = async (url) => {
    try {
        new URL(url);
        // Visit the URL and check for a 200 response and a valid image content type
        const result = new Promise((resolve) => {
            fetch(url)
                .then((response) => {
                    if (
                        response.status === 200 &&
                        response.headers
                            .get('content-type')
                            .startsWith('image/')
                    ) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                })
                .catch(() => {
                    resolve(false);
                });
        });
        return result;
    } catch (err) {
        return false;
    }
};

const scrapeMetadata = async (url) => {
    const result = new Promise((resolve) => {
        fetch(url)
            .then((response) => {
                return response.text();
            })
            .then(async (html) => {
                const $ = cheerio.load(html);
                const metadata = {
                    title: $('title').text(),
                    description: $('meta[name="description"]').attr('content'),
                    image: $('meta[property="og:image"]').attr('content'),
                    url: $('meta[property="og:url"]').attr('content'),
                    icon: $('link[rel="icon"]').attr('href'),
                };
                const origin = new URL(url).origin;
                // Ensure that the image and icon are absolute URLs
                if (metadata.image && metadata.image.startsWith('/')) {
                    metadata.image = origin + metadata.image;
                }
                if (metadata.icon && metadata.icon.startsWith('/')) {
                    metadata.icon = origin + metadata.icon;
                }
                // Ensure that the image and icon are valid URLs
                const validImage =
                    metadata.image && (await validateUrl(metadata.image));
                const validIcon =
                    metadata.icon && (await validateUrl(metadata.icon));
                if (validImage === false) {
                    metadata.image = undefined;
                }
                if (validIcon === false) {
                    metadata.icon = undefined;
                }
                resolve(metadata);
            })
            .catch((err) => {
                console.log(err);
                // Fail silently - we don't want to break the pointer creation
                resolve({});
            });
    });
    return await result;
};

export default scrapeMetadata;
