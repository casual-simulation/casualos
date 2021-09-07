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
    entry: {
        metadata: path.resolve(__dirname, 'src', 'handlers', 'metadata.js'),
        services: path.resolve(__dirname, 'src', 'handlers', 'services.js'),
        records: path.resolve(__dirname, 'src', 'handlers', 'records.js'),
    },
    target: 'node14.16',
    node: {
        __filename: false,
        __dirname: false,
    },
    output: {
        filename: 'handlers/[name].js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            type: 'commonjs2',
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                include: [__dirname],
                exclude: /node_modules/,
            },
            {
                test: /\.(pem|txt)$/,
                use: [
                    {
                        loader: 'raw-loader',
                        options: {},
                    },
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.ts'],
        alias: {},
    },
    plugins: [
        new webpack.ContextReplacementPlugin(/socket\.io/, /socket\.io-client/),
        new webpack.ContextReplacementPlugin(/express/, /express/),
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),
        }),
    ],
};
