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
const server = path.resolve(auxServer, 'server');
const serverDist = path.resolve(server, 'dist');
const serverPackageJson = path.resolve(auxServer, 'package.json');
const serverExternals = [...getExternals(serverPackageJson), 'esbuild'];

const auxWeb = path.resolve(auxServer, 'aux-web');
const auxWebDist = path.resolve(auxWeb, 'dist');

const auxVmDeno = path.resolve(src, 'aux-vm-deno');
const denoEntry = path.resolve(auxVmDeno, 'vm', 'DenoAuxChannel.worker.js');

module.exports = {
    createConfigs,
    cleanDirectories,
};

function cleanDirectories() {
    cleanDirectory(serverDist);
    cleanDirectory(auxWebDist);
}

function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: version ?? JSON.stringify(GIT_TAG),
    };
    const developmentVariables = {
        DEVELOPMENT: dev ?? JSON.stringify(true),
    };
    return [
        [
            'Server',
            {
                entryPoints: [path.resolve(server, 'index.ts')],
                outfile: path.resolve(serverDist, 'main.js'),
                platform: 'node',
                target: ['node12.16'],
                external: serverExternals,
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                minify: !dev,
                plugins: [replaceThreePlugin()],
            },
        ],
        [
            'Deno',
            {
                entryPoints: [denoEntry],
                outfile: path.resolve(auxWebDist, 'deno.js'),
                platform: 'browser',
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                minify: !dev,
                plugins: [replaceThreePlugin(), replaceEsbuildPlugin()],
            },
        ],
    ];
}
