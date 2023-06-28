const path = require('path');
const {
    paths,
    cleanDirectory,
    watch,
    setup,
    getExternals,
    replaceEsbuildPlugin,
    replaceThreePlugin,
} = require('../../script/build-helpers');
const { GIT_HASH, GIT_TAG } = require('../../script/git-stats');
const copy = require('esbuild-copy-static-files');

const docs = path.resolve(paths.root, 'docs');
const docsPackageJson = path.resolve(docs, 'package.json');
const docsExternals = [...getExternals(docsPackageJson), 'esbuild', 'path', 'webpack-virtual-modules'];

const typedocPlugin = path.resolve(docs, 'typedoc-plugin');
const static = path.resolve(typedocPlugin, 'static');
const entry = path.resolve(static, 'entry.ts');
const tsconfig = path.resolve(static, 'tsconfig.json');
const types = path.resolve(static, 'types.d.ts');

const typedocDist = path.resolve(typedocPlugin, 'dist');

module.exports = {
    createConfigs,
    cleanDirectories,
};

function cleanDirectories() {
    cleanDirectory(typedocDist);
}

function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(version ?? GIT_TAG),
    };
    const developmentVariables = {
        DEVELOPMENT: dev ?? JSON.stringify(true),
    };
    return [
        [
            'Typedoc',
            {
                entryPoints: [path.resolve(typedocPlugin, 'index.ts')],
                outfile: path.resolve(typedocDist, 'index.js'),
                platform: 'node',
                target: ['node14.16'],
                external: docsExternals,
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                loader: {
                    '.mdx': 'text'
                },
                minify: false,
                plugins: [
                    copy({
                        src: entry,
                        dest: path.resolve(
                            typedocDist,
                            'entry.ts'
                        ),
                        force: true,
                    }),
                    copy({
                        src: tsconfig,
                        dest: path.resolve(
                            typedocDist,
                            'tsconfig.json'
                        ),
                        force: true,
                    }),
                    copy({
                        src: types,
                        dest: path.resolve(
                            typedocDist,
                            'types.d.ts'
                        ),
                        force: true,
                    }),
                ],
            },
        ],
    ];
}
