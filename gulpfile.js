const gulp = require('gulp');
const del = require('del');

let folders = [
    `${__dirname}/src/aux-common`,
    `${__dirname}/src/causal-trees`,
    `${__dirname}/src/crypto`,
    `${__dirname}/src/crypto-node`,
    `${__dirname}/src/crypto-browser`,
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
