const gulp = require('gulp');
const del = require('del');
const childProcess = require('child_process');
const path = require('path');

let folders = [
    `${__dirname}/src/aux-common`,
    `${__dirname}/src/causal-trees/lib`,
    `${__dirname}/src/causal-tree-server-socketio/lib`,
    `${__dirname}/src/crypto/lib`,
    `${__dirname}/src/crypto-node/lib`,
    `${__dirname}/src/crypto-browser/lib`,
];

let patterns = [`/**/*.js`, `/**/*.js.map`, `/**/*.d.ts`];

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

gulp.task('build:libs', function() {
    return childProcess.exec('npx tsc --build');
});

gulp.task('build:server', function() {
    return childProcess.exec('npm run build', {
        cwd: path.resolve(__dirname, 'src', 'aux-server'),
    });
});

gulp.task('build', ['clean', 'build:libs', 'build:server']);
