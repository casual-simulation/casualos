const path = require('path');
const VirtualModulesPlugin = require('webpack-virtual-modules');
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

        configureWebpack: function(config, isServer, utils, content) {
            let modules = {};
            for(let child of content.children) {
                modules[`node_modules/@api/${child.name}`] = `module.exports = ${JSON.stringify(child)};`;
            }
            const plugin = new VirtualModulesPlugin(modules);

            return {
                module: {
                    rules: [
                        {
                            test: /^@api\//i,
                            type: 'javascript/esm'
                        }
                    ]
                },
                plugins: [ plugin ]
            };
        }
    };
}