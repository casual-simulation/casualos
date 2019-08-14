const childProcess = require('child_process');
const path = require('path');
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
    externals: [],
    plugins: [
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),
        }),
    ],
};
