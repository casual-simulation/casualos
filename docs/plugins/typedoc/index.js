const { getProject } = require('./api');

module.exports = function pluginTypedoc(context, options) {
    const { } = options;
    const isProd = process.env.NODE_ENV === 'production';
    return {
        name: 'docusaurus-plugin-typedoc',
        loadContent: function() {
            const { app, project} = getProject();
            if (!project) {
                console.warn('[docusarus-plugin-typedoc] Unable to load TypeDoc project!');
            }
            console.log('loadContent');
            return app.serializer.projectToObject(project);
        },

        contentLoaded: function({content, actions}) {
            console.log('contentLoaded');
            const { setGlobalData } = actions;
            const project = content;

            setGlobalData({ project: project });
        }
    };
}