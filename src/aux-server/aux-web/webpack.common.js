const childProcess = require('child_process');
const path = require('path');
const process = require('process');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const OfflinePlugin = require('offline-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
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
        player: path.resolve(__dirname, 'aux-player', 'index.ts'),
        vm: path.resolve(
            __dirname,
            '..',
            '..',
            'aux-vm-browser',
            'html',
            'IframeEntry.ts'
        ),
    },
    output: {
        publicPath: '/',
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        // globalObject: 'self',
    },
    node: {
        console: false,
        global: true,
        process: false,
        __filename: 'mock',
        __dirname: 'mock',

        // Buffer is needed for sha.js
        Buffer: true,
        setImmediate: false,
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                use: {
                    loader: 'vue-loader',
                    options: {
                        transformAssetUrls: {
                            video: ['src', 'poster'],
                            source: ['src', 'srcset'],
                            img: 'src',
                            image: ['xlink:href', 'href'],
                            use: ['xlink:href', 'href'],
                        },
                    },
                },
                exclude: /node_modules/,
            },
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                include: [__dirname, path.resolve(__dirname, '..', 'shared')],
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['vue-style-loader', 'css-loader'],
            },
            {
                test: /\.svg$/,
                use: 'vue-svg-loader',
            },
            {
                test: /von-grid.min.js$/,
                use: 'exports-loader?vg=vg',
            },
            {
                test: /\.(png|jpg|gif|gltf|webp)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {},
                    },
                ],
            },
            {
                test: /\.(ttf|woff|woff2)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: './fonts/[name].[ext]',
                        },
                    },
                ],
            },
            {
                test: /three\/examples\/js/,
                use: 'imports-loader?THREE=three',
            },
            {
                test: /\.js$/,
                use: ['source-map-loader'],
                include: [/aux-common/, /aux-vm/],
                enforce: 'pre',
            },
        ],
    },
    resolve: {
        extensions: ['.vue', '.js', '.ts', '.css'],
        alias: {
            'webxr-polyfill': path.resolve(
                __dirname,
                'shared/public/scripts/webxr-polyfill.js'
            ),
            'vue-json-tree-view': path.resolve(
                __dirname,
                'shared/public/VueJsonTreeView/index.ts'
            ),
            'three-bmfont-text': path.resolve(
                __dirname,
                'shared/public/three-bmfont-text/'
            ),
            'three-legacy-gltf-loader': path.resolve(
                __dirname,
                'shared/public/three-legacy-gltf-loader/LegacyGLTFLoader.js'
            ),
            'layout-bmfont-text': path.resolve(
                __dirname,
                'shared/public/layout-bmfont-text/index.js'
            ),
            'word-wrapper': path.resolve(
                __dirname,
                'shared/public/layout-bmfont-text/word-wrapper.js'
            ),
            'as-number': path.resolve(
                __dirname,
                'shared/public/layout-bmfont-text/as-number.js'
            ),
            'array-shuffle': path.resolve(
                __dirname,
                'shared/public/array-shuffle/index.js'
            ),
            'quad-indices': path.resolve(
                __dirname,
                'shared/public/quad-indices/index.js'
            ),
            'an-array': path.resolve(
                __dirname,
                'shared/public/quad-indices/an-array.js'
            ),
            'three-buffer-vertex-data': path.resolve(
                __dirname,
                'shared/public/three-buffer-vertex-data/index.js'
            ),
            dtype: path.resolve(__dirname, 'shared/public/dtype/index.js'),
            'flatten-vertex-data': path.resolve(
                __dirname,
                'shared/public/flatten-vertex-data/index.js'
            ),
            'three-vrcontroller-module': path.resolve(
                __dirname,
                'shared/public/three-vrcontroller-module/VRController.js'
            ),
            callforth: path.resolve(
                __dirname,
                'shared/public/callforth/index.js'
            ),
            'vue-qrcode-reader': path.resolve(
                __dirname,
                'shared/public/vue-qrcode-reader/'
            ),
            'clipboard-polyfill': path.resolve(
                __dirname,
                'shared/public/clipboard-polyfill/clipboard-polyfill.js'
            ),
        },
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CircularDependencyPlugin({
            exclude: /node_modules/,
            failOnError: false,
            allowAsyncCycles: false,
            cwd: process.cwd(),
        }),
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            chunks: ['player', 'vendors', 'monaco'],
            // inject: false,
            template: path.resolve(__dirname, 'aux-player', 'index.html'),
            title: 'auxPlayer',
            filename: 'player.html',
        }),
        new HtmlWebpackPlugin({
            chunks: ['vm', 'vendors'],
            // inject: false,
            template: path.resolve(
                __dirname,
                '..',
                '..',
                'aux-vm-browser',
                'html',
                'iframe_host.html'
            ),
            title: 'AUX VM',
            filename: 'aux-vm-iframe.html',
        }),
        new webpack.ProvidePlugin({
            THREE: 'three',
        }),
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),
        }),
        new OfflinePlugin({
            // chunks: ['player'],
            appShell: '/',
            AppCache: false,
            ServiceWorker: {
                events: true,
                entry: path.resolve(__dirname, 'shared', 'sw.ts'),
            },
            // rewrites: function(asset) {
            //     if (asset.endsWith('projector-index.html')) {
            //         return '/';
            //     } else if (asset.endsWith('player-index.html')) {
            //         return '/';
            //     }

            //     return asset;
            // },
            cacheMaps: [
                {
                    requestTypes: ['navigate'],
                },
            ],
            externals: [
                'https://fonts.googleapis.com/css?family=Roboto:400,500,700,400italic|Material+Icons',
            ],
        }),
    ],
};
