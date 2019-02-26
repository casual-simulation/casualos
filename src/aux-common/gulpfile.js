var gulp = require('gulp');
var del = require('del');

gulp.task('clean', function () {
  return del([
    '**/*.js',
    '**/*.js.map',
    '**/*.d.ts',
    '!gulpfile.js',
    '!typings/**/*'
  ]);
});
