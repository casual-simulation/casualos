let { task, desc } = require('jake');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');

function makeGlobbablePath(path) {
    return path.replace(/\\/g, '/');
}

let folders = [
    `${__dirname}/src/aux-common`,
    `${__dirname}/src/aux-components`,
    `${__dirname}/src/aux-vm`,
    `${__dirname}/src/aux-vm-client`,
    `${__dirname}/src/aux-vm-node`,
    `${__dirname}/src/aux-vm-browser`,
    `${__dirname}/src/aux-vm-deno`,
    `${__dirname}/src/crypto`,
    `${__dirname}/src/crypto-node`,
    `${__dirname}/src/crypto-browser`,
    `${__dirname}/src/tunnel`,
    `${__dirname}/src/undom`,
    `${__dirname}/src/websocket`,
    `${__dirname}/src/fast-json-stable-stringify`,
    `${__dirname}/src/fast-json-stable-stringify`,
    `${__dirname}/src/expect`,
    `${__dirname}/src/chalk`,
    `${__dirname}/temp/aux-server`,
    `${__dirname}/src/aux-runtime`,
    `${__dirname}/src/aux-records`,
    `${__dirname}/src/aux-records-aws`,
    `${__dirname}/src/timesync`,
    `${__dirname}/src/js-interpreter`,
    `${__dirname}/src/vue-shortkey`,
    `${__dirname}/src/rate-limit-redis`,
    `${__dirname}/src/aux-websocket`,
    `${__dirname}/src/aux-websocket-aws`,
    `${__dirname}/src/casualos-cli`,
    `${__dirname}/src/casualos-infra`,
];

let patterns = [
    `/**/*.js`,
    `/**/*.jsx`,
    `/**/*.js.map`,
    `/**/*.jsx.map`,
    `/**/*.ts.map`,
    `/**/*.d.ts`,
    `/*.tsbuildinfo`,
];

let negativePatterns = [`/typings/**/*`, `/node_modules/**/*`];

let globs = [
    `${__dirname}/src/aux-server/aux-web/dist`,
    `${__dirname}/src/aux-server/aux-web/aux-player/vite.config.mts.timestamp-*`,
    `${__dirname}/src/aux-server/aux-web/aux-auth/vite.config.mts.timestamp-*`,
];
folders.forEach((f) => {
    patterns.forEach((p) => {
        globs.push(f + p);
    });

    negativePatterns.forEach((p) => {
        globs.push(`!${f}${p}`);
    });
});

globs = globs.map((g) => makeGlobbablePath(g));

task('clean', ['generate-stub-projects'], async function () {
    const { deleteAsync } = await import('del');
    const deleted = await deleteAsync(globs);
});

task('clean-cache', [], async function () {
    const { deleteAsync } = await import('del');
    await deleteAsync([
        makeGlobbablePath(`${__dirname}/src/aux-server/node_modules/.vite`),
    ]);
});

task('generate-stub-projects', [], async function () {
    const { existsSync, writeFileSync, mkdirSync } = await import('fs');

    const projects = [
        path.resolve(__dirname, 'xpexchange', 'tsconfig.json'),
        path.resolve(
            __dirname,
            'extensions',
            'casualos-casualware',
            'casualware-api',
            'tsconfig.json'
        ),
    ];

    const defaultProjectJson = {
        compilerOptions: {
            baseUrl: '.',
            outDir: '../../temp/xp-api/',
            composite: true,
            incremental: true,
        },
        include: ['**/*.ts'],
        exclude: ['node_modules', 'lib', '**/*.spec.ts'],
        references: [],
    };

    for (let project of projects) {
        const result = existsSync(project);
        if (!result) {
            console.log('Creating tsconfig.json stub for ' + project);
            const dirname = path.dirname(project);
            mkdirSync(dirname, { recursive: true });

            const pathToTsconfigBase = path.relative(
                dirname,
                path.resolve(__dirname, 'tsconfig.base.json')
            );

            writeFileSync(
                project,
                JSON.stringify(
                    {
                        extends: pathToTsconfigBase,
                        ...defaultProjectJson,
                    },
                    null,
                    2
                ),
                {
                    encoding: 'utf-8',
                    flag: 'w',
                }
            );
        }
    }
});
