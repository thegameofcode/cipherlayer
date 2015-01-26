var gulp = require('gulp');
var jshint = require('gulp-jshint');

var SOURCE_FOLDERS = ['./src/**/*.js', './features/**/*.js', 'gulpfile.js'];

//
// Check code style and lint
//
gulp.task('jshint', function() {
    return gulp.src(SOURCE_FOLDERS)
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});
