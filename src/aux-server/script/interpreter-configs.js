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
const { GIT_HASH, GIT_TAG } = require('../../../script/git-stats');

const src = path.resolve(paths.root, 'src');
const auxServer = path.resolve(src, 'aux-server');

const auxWeb = path.resolve(auxServer, 'aux-web');
const auxWebPlayer = path.resolve(auxWeb, 'aux-player');
const auxWebDist = path.resolve(auxWeb, 'dist');

const interpreterEntry = path.resolve(
    auxWebPlayer,
    'shim',
    'interpreter-shim.ts'
);

module.exports = {
    createConfigs,
};

function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(version ?? GIT_TAG),
    };
    const developmentVariables = {
        DEVELOPMENT: JSON.stringify(dev ?? true),
    };
    return [
        [
            'Interpreter',
            {
                entryPoints: [interpreterEntry],
                outfile: path.resolve(auxWebDist, 'interpreter.js'),
                platform: 'browser',
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                minify: !dev,
                sourcemap: true,
            },
        ],
    ];
}
