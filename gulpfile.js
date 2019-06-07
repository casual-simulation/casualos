const gulp = require('gulp');
const del = require('del');
const childProcess = require('child_process');
const path = require('path');

let folders = [
    `${__dirname}/src/aux-common`,
    `${__dirname}/src/aux-vm`,
    `${__dirname}/src/causal-trees`,
    `${__dirname}/src/causal-tree-server-socketio`,
    `${__dirname}/src/causal-tree-client-socketio`,
    `${__dirname}/src/causal-tree-store-mongodb`,
    `${__dirname}/src/causal-tree-store-browser`,
    `${__dirname}/src/crypto`,
    `${__dirname}/src/crypto-node`,
    `${__dirname}/src/crypto-browser`,
];

let patterns = [`/**/*.js`, `/**/*.js.map`, `/**/*.d.ts`, `/*.tsbuildinfo`];

let negativePatterns = [`/typings/**/*`];

let globs = [];
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
