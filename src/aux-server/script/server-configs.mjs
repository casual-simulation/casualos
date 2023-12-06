import path from 'path';
import {
    paths,
    cleanDirectory,
    getExternals,
    replaceEsbuildPlugin,
    replaceThreePlugin,
} from '../../../script/build-helpers.mjs';
import { GIT_HASH, GIT_TAG } from '../../../script/git-stats.mjs';
import copy from 'esbuild-copy-static-files';

const src = path.resolve(paths.root, 'src');
const auxServer = path.resolve(src, 'aux-server');
const auxBackend = path.resolve(auxServer, 'aux-backend');
const server = path.resolve(auxBackend, 'server');
const serverDist = path.resolve(server, 'dist');
const serverPackageJson = path.resolve(auxServer, 'package.json');
const serverExternals = [...getExternals(serverPackageJson), 'esbuild'];

const auxWeb = path.resolve(auxServer, 'aux-web');
const auxWebDist = path.resolve(auxWeb, 'dist');

const auxAuth = path.resolve(auxWeb, 'aux-auth');
const auxAuthDist = path.resolve(auxAuth, 'dist');

const auxVmDeno = path.resolve(src, 'aux-vm-deno');
const denoEntry = path.resolve(auxVmDeno, 'vm', 'DenoAuxChannel.worker.js');

const serverless = path.resolve(auxBackend, 'serverless');
const serverlessDist = path.resolve(serverless, 'aws', 'dist');
const serverlessSrc = path.resolve(serverless, 'aws', 'src');
const serverlessHandlers = path.resolve(serverlessSrc, 'handlers');

const schema = path.resolve(auxBackend, 'schemas', 'auth.prisma');

let SERVER_CONFIG = null;
if (process.env.SERVER_CONFIG) {
    SERVER_CONFIG = JSON.parse(process.env.SERVER_CONFIG);
}

export function cleanDirectories() {
    cleanDirectory(serverDist);
    cleanDirectory(auxWebDist);
    cleanDirectory(serverlessDist);
    cleanDirectory(auxAuthDist);
}

export function createConfigs(dev, version) {
    const versionVariables = {
        GIT_HASH: JSON.stringify(GIT_HASH),
        GIT_TAG: JSON.stringify(version ?? GIT_TAG),
    };
    const configVariables = {
        SERVER_CONFIG: JSON.stringify(SERVER_CONFIG),
    };
    const developmentVariables = {
        DEVELOPMENT: dev ? JSON.stringify(true) : JSON.stringify(false),
    };

    const extraVariables = {};
    if (dev) {
        extraVariables.S3_ENDPOINT = JSON.stringify('http://s3:4566');
    } else {
        extraVariables.S3_ENDPOINT = 'undefined';
    }

    return [
        [
            'Server',
            {
                entryPoints: [path.resolve(server, 'index.ts')],
                outfile: path.resolve(serverDist, 'main.js'),
                platform: 'node',
                target: ['node14.16'],
                external: serverExternals,
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                    ...configVariables,
                },
                minify: !dev,
                plugins: [replaceThreePlugin()],
            },
        ],
        [
            'Serverless',
            {
                entryPoints: [path.resolve(serverlessHandlers, 'Records')],
                outdir: path.resolve(serverlessDist, 'handlers'),
                platform: 'node',
                target: ['node14.16'],
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                    ...configVariables,
                    ...extraVariables,
                },
                plugins: [
                    copy({
                        src: schema,
                        dest: path.resolve(
                            serverlessDist,
                            'handlers',
                            'schema.prisma'
                        ),
                        force: true,
                    }),
                    copy({
                        src: path.resolve(
                            paths.nodeModules,
                            '.prisma',
                            'client',
                            'libquery_engine-rhel-openssl-1.0.x.so.node'
                        ),
                        dest: path.resolve(
                            serverlessDist,
                            'handlers',
                            'libquery_engine-rhel-openssl-1.0.x.so.node'
                        ),
                        force: true,
                    }),
                ],
                minify: !dev,
            },
        ],
        [
            'Serverless Websockets',
            {
                entryPoints: [path.resolve(serverlessHandlers, 'websockets')],
                outdir: path.resolve(serverlessDist, 'handlers'),
                platform: 'node',
                target: ['node14.16'],
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                    ...configVariables,
                    ...extraVariables,
                },
                minify: !dev,
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
