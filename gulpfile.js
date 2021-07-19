const gulp = require('gulp');
const del = require('del');
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');

let folders = [
    `${__dirname}/src/aux-common`,
    `${__dirname}/src/aux-vm`,
    `${__dirname}/src/aux-vm-client`,
    `${__dirname}/src/aux-vm-node`,
    `${__dirname}/src/aux-vm-browser`,
    `${__dirname}/src/aux-vm-deno`,
    `${__dirname}/src/causal-trees`,
    `${__dirname}/src/causal-tree-server`,
    `${__dirname}/src/causal-tree-server-socketio`,
    `${__dirname}/src/causal-tree-client-socketio`,
    `${__dirname}/src/causal-tree-client-apiary`,
    `${__dirname}/src/causal-tree-store-mongodb`,
    `${__dirname}/src/causal-tree-store-cassandradb`,
    `${__dirname}/src/causal-tree-store-browser`,
    `${__dirname}/src/crypto`,
    `${__dirname}/src/crypto-node`,
    `${__dirname}/src/crypto-browser`,
    `${__dirname}/src/tunnel`,
    `${__dirname}/src/undom`,
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

gulp.task('view:web:profile', function () {
    const projectDir = path.resolve(__dirname, 'src', 'aux-server');
    const source = path.resolve(projectDir, 'web_bundle_stats.json');
    const dest = path.resolve(
        projectDir,
        'aux-web',
        'dist',
        'web_bundle_stats.json'
    );
    fs.copyFileSync(source, dest);

    const proc = childProcess.exec('webpack-bundle-analyzer ' + dest);
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
    process.stdin.pipe(proc.stdin);
});

gulp.task('view:server:profile', function () {
    const projectDir = path.resolve(__dirname, 'src', 'aux-server');
    const source = path.resolve(projectDir, 'server_bundle_stats.json');
    const dest = path.resolve(
        projectDir,
        'server',
        'dist',
        'server_bundle_stats.json'
    );
    fs.copyFileSync(source, dest);

    const proc = childProcess.exec('webpack-bundle-analyzer ' + dest);
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
    process.stdin.pipe(proc.stdin);
});
