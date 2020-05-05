const gulp = require('gulp');
const del = require('del');
const childProcess = require('child_process');
const path = require('path');

let folders = [
    `${__dirname}/src/aux-common`,
    `${__dirname}/src/aux-vm`,
    `${__dirname}/src/aux-vm-client`,
    `${__dirname}/src/aux-vm-node`,
    `${__dirname}/src/aux-vm-browser`,
    `${__dirname}/src/causal-trees`,
    `${__dirname}/src/causal-tree-server`,
    `${__dirname}/src/causal-tree-server-socketio`,
    `${__dirname}/src/causal-tree-client-socketio`,
    `${__dirname}/src/causal-tree-store-mongodb`,
    `${__dirname}/src/causal-tree-store-cassandradb`,
    `${__dirname}/src/causal-tree-store-browser`,
    `${__dirname}/src/crypto`,
    `${__dirname}/src/crypto-node`,
    `${__dirname}/src/crypto-browser`,
    `${__dirname}/src/tunnel`,
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
folders.forEach(f => {
    patterns.forEach(p => {
        globs.push(f + p);
    });

    negativePatterns.forEach(p => {
        globs.push(`!${f}${p}`);
    });
});

gulp.task('clean', function() {
    return del(globs);
});

gulp.task('clean:cache', function() {
    return del([`${__dirname}/src/aux-server/node_modules/.cache`]);
});
