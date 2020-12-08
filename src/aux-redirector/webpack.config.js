const childProcess = require('child_process');
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const commitHash = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .trim();
const latestTag = childProcess
    .execSync('git describe --abbrev=0 --tags')
    .toString()
    .trim();

module.exports = {
    mode: 'development',
    entry: path.resolve(__dirname, 'index.ts'),
    target: 'node',
    node: {
        __filename: false,
        __dirname: false,
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                include: [__dirname],
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.ts'],
        alias: {},
    },
    externals: [
        function (context, request, callback) {
            // Every non-relative module is external
            if (/^[a-z\-0-9]+$/.test(request)) {
                return callback(null, 'commonjs ' + request);
            }
            callback();
        },
        nodeExternals({
            allowlist: /^@casual-simulation\/(?!aux-server)/,

            // Use package.json instead of node_modules.
            // This way we can exclude packages even though they're not in the first node_modules
            // directory
            modulesFromFile: true,
        }),
    ], // in order to ignore all modules in node_modules folder
    plugins: [
        new webpack.ContextReplacementPlugin(/socket\.io/, /socket\.io-client/),
        new webpack.ContextReplacementPlugin(/express/, /express/),
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),
        }),
    ],
};
