const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');
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

const magicSecretKeyPath = path.resolve(
    __dirname,
    '..',
    'MAGIC_SECRET_KEY.txt'
);
const magicSecretKey = fs.existsSync(magicSecretKeyPath)
    ? fs.readFileSync(magicSecretKeyPath, 'utf8').trim()
    : null;

module.exports = {
    entry: path.resolve(__dirname, 'index.ts'),
    target: 'node12.16',
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
    externals: [
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
            MAGIC_SECRET_KEY: JSON.stringify(
                process.env.MAGIC_SECRET_KEY ?? magicSecretKey
            ),
        }),
    ],
};
