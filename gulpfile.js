const gulp = require('gulp');
const del = require('del');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');

let folders = [
    `${__dirname}/src/aux-common`,
    `${__dirname}/src/aux-components`,
    `${__dirname}/src/aux-vm`,
    `${__dirname}/src/aux-vm-client`,
    `${__dirname}/src/aux-vm-node`,
    `${__dirname}/src/aux-vm-browser`,
    `${__dirname}/src/aux-vm-deno`,
    `${__dirname}/src/causal-trees`,
    `${__dirname}/src/causal-tree-server`,
    `${__dirname}/src/causal-tree-server-websocket`,
    `${__dirname}/src/causal-tree-client-websocket`,
    `${__dirname}/src/causal-tree-client-apiary`,
    `${__dirname}/src/causal-tree-store-mongodb`,
    `${__dirname}/src/causal-tree-store-cassandradb`,
    `${__dirname}/src/causal-tree-store-browser`,
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
    `${__dirname}/temp/aux-auth`,
    `${__dirname}/temp/aux-server`,
    `${__dirname}/src/aux-records`,
    `${__dirname}/src/aux-records-aws`,
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

gulp.task('clean', function () {
    return del(globs);
});

gulp.task('clean:cache', function () {
    return del([`${__dirname}/src/aux-server/node_modules/.cache`]);
});
