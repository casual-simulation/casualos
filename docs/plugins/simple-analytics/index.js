
module.exports = function pluginSimpleAnalytics(context, options) {
    const { customDomain } = options;
    const isProd = process.env.NODE_ENV === 'production';
    const scriptDomain = customDomain ?? 'scripts.simpleanalyticscdn.com';
    const imgDomain = customDomain ?? 'queue.simpleanalyticscdn.com';
    return {
        name: 'docusaurus-plugin-simple-analytics',

        injectHtmlTags() {
            if (!isProd) {
                return {};
            }
            return {
                postBodyTags: [
                    // https://docs.simpleanalytics.com/script
                    {
                        tagName: 'script',
                        attributes: {
                            async: true,
                            defer: true,
                            src: `https://${scriptDomain}/latest.js`,
                        },
                    },
                    {
                        tagName: 'noscript',
                        innerHTML: `<img src="https://${imgDomain}/noscript.gif" alt="" referrerpolicy="no-referrer-when-downgrade" />`
                    }
                ],
            };
        },
    };
}