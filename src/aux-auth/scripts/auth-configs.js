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
const copy = require('esbuild-copy-static-files');

const src = path.resolve(paths.root, 'src');
const auxAuth = path.resolve(src, 'aux-auth');
const server = path.resolve(auxAuth, 'server');
const serverDist = path.resolve(server, 'dist');
const serverPackageJson = path.resolve(auxAuth, 'package.json');
const serverExternals = [...getExternals(serverPackageJson), 'esbuild'];

const serverless = path.resolve(auxAuth, 'serverless');
const serverlessDist = path.resolve(serverless, 'aws', 'dist');
const serverlessSrc = path.resolve(serverless, 'aws', 'src');
const serverlessHandlers = path.resolve(serverlessSrc, 'handlers');

const schema = path.resolve(auxAuth, 'schemas', 'auth.prisma');

module.exports = {
    createConfigs,
    cleanDirectories,
};

function cleanDirectories() {
    cleanDirectory(serverDist);
    cleanDirectory(serverlessDist);
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
            'Auth Server',
            {
                entryPoints: [path.resolve(server, 'index.ts')],
                outfile: path.resolve(serverDist, 'main.js'),
                platform: 'node',
                target: ['node14.16'],
                external: serverExternals,
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                },
                minify: !dev,
            },
        ],
        [
            'Auth Serverless',
            {
                entryPoints: [path.resolve(serverlessHandlers, 'Records')],
                outdir: path.resolve(serverlessDist, 'handlers'),
                platform: 'node',
                target: ['node14.16'],
                define: {
                    ...versionVariables,
                    ...developmentVariables,
                    S3_ENDPOINT: dev
                        ? JSON.stringify('http://s3:4566')
                        : JSON.stringify(undefined),
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
    ];
}
