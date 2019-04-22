var gulp = require('gulp');
var del = require('del');

gulp.task('clean', function() {
    return del([
        `${__dirname}/**/*.js`,
        `${__dirname}/**/*.js.map`,
        `${__dirname}/**/*.d.ts`,
        `!${__dirname}/**/gulpfile.js`,
        `!${__dirname}/typings/**/*`,
    ]);
});
