const path = require('path');
const {
    paths,
    cleanDirectory,
    watch,
    setup,
    getExternals,
    replaceEsbuildPlugin,
    replaceThreePlugin,
} = require('../../../script/build-helpers');
const fs = require('fs');
const { GIT_HASH, GIT_TAG } = require('../../../script/git-stats');

const src = path.resolve(paths.root, 'src');
const apiaryAws = path.resolve(src, 'casual-apiary-aws');
const apiaryDist = path.resolve(apiaryAws, 'dist');
const packageJson = path.resolve(apiaryAws, 'package.json');
const serverExternals = [...getExternals(packageJson), 'esbuild'];

module.exports = {
    createConfigs,
    cleanDirectories,
};

function cleanDirectories() {
    cleanDirectory(apiaryDist);
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
            'Casual Apiary AWS',
            {
                entryPoints: [path.resolve(apiaryAws, 'handler.ts')],
                outdir: path.resolve(apiaryDist, 'handlers'),
                platform: 'node',
                target: ['node14.16'],
                external: serverExternals,
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                treeShaking: true,
                metafile: true,
                minify: !dev,
            },
        ],
    ];
}
