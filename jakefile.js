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
];

let patterns = [
    `/**/*.js`,
    `/**/*.js.map`,
    `/**/*.ts.map`,
    `/**/*.d.ts`,
    `/*.tsbuildinfo`,
];

let negativePatterns = [`/typings/**/*`];

let globs = [`${__dirname}/src/aux-server/aux-web/dist`];
folders.forEach((f) => {
    patterns.forEach((p) => {
        globs.push(f + p);
    });

    negativePatterns.forEach((p) => {
        globs.push(`!${f}${p}`);
    });
});

globs = globs.map((g) => makeGlobbablePath(g));

task('clean', [], async function () {
    const { deleteAsync } = await import('del');
    const deleted = await deleteAsync(globs);
});

task('clean-cache', [], async function () {
    const { deleteAsync } = await import('del');
    await deleteAsync([
        makeGlobbablePath(`${__dirname}/src/aux-server/node_modules/.vite`),
    ]);
});
