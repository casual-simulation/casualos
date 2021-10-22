const path = require('path');
const {
    paths,
    cleanDirectory,
    watch,
    getExternals,
    replaceEsbuildPlugin,
    replaceThreePlugin,
} = require('./build-helpers');
const { GIT_HASH, GIT_TAG } = require('./git-stats');

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

const versionVariables = {
    GIT_HASH: JSON.stringify(GIT_HASH),
    GIT_TAG: JSON.stringify(GIT_TAG),
};

const developmentVariables = {
    DEVELOPMENT: JSON.stringify(true),
};

cleanDirectory(serverDist);
cleanDirectory(auxWebDist);

watchServer();
watchDeno();

function watchServer() {
    return watch('Server', {
        entryPoints: [path.resolve(server, 'index.ts')],
        outfile: path.resolve(serverDist, 'main.js'),
        platform: 'node',
        target: ['node12.16'],
        external: serverExternals,
        define: {
            ...versionVariables,
            ...developmentVariables,
        },
        plugins: [replaceThreePlugin()],
    });
}

function watchDeno() {
    return watch('Deno', {
        entryPoints: [denoEntry],
        outfile: path.resolve(auxWebDist, 'deno.js'),
        platform: 'browser',
        define: {
            ...versionVariables,
            ...developmentVariables,
        },
        plugins: [replaceThreePlugin(), replaceEsbuildPlugin()],
    });
}
