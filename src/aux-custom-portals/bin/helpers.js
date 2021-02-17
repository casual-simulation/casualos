const { object } = require('@hapi/joi');

function emptyModulePlugin(moduleId, filter = new RegExp(`^${moduleId}$`)) {
    return {
        name: 'emptyModulePlugin',
        setup: (build) => {
            build.onResolve({ filter: filter }, (args) => ({
                path: args.path,
                namespace: `empty-ns-${moduleId}`,
            }));

            build.onLoad(
                { filter: filter, namespace: `empty-ns-${moduleId}` },
                (args) => ({
                    contents: '',
                    loader: 'js',
                })
            );
        },
    };
}

function injectModulePlugin(
    moduleId,
    mod,
    filter = new RegExp(`^${moduleId}$`)
) {
    return {
        name: 'emptyModulePlugin',
        setup: (build) => {
            build.onResolve({ filter: filter }, (args) => ({
                path: args.path,
                namespace: `inject-ns-${moduleId}`,
            }));

            build.onLoad(
                { filter: filter, namespace: `inject-ns-${moduleId}` },
                (args) => ({
                    contents: Object.keys(mod)
                        .map(
                            (k) =>
                                `export const ${k} = ${JSON.stringify(mod[k])};`
                        )
                        .join('\n'),
                    loader: 'js',
                })
            );
        },
    };
}

module.exports = {
    emptyModulePlugin,
    injectModulePlugin,
};
