const childProcess = require('child_process');
const path = require('path');
const process = require('process');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
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
        deno: path.resolve(
            __dirname,
            '..',
            '..',
            'aux-vm-deno',
            'vm',
            'DenoEntry.js'
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
                test: /\.(ttf|woff|woff2|otf)$/,
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

            // See https://github.com/dchest/tweetnacl-js/wiki/Using-with-Webpack
            // Gist is that tweetnacl-js has some require() statements that webpack
            // will parse and may try to include shims automatically.
            // So here we tell webpack to ignore tweetnacl and import from the global
            // window.nacl property.
            {
                test: /[\\\/]tweetnacl[\\\/]/,
                loader:
                    'exports-loader?globalThis.nacl!imports-loader?this=>globalThis,module=>{},require=>false',
            },
        ],
        noParse: [/[\\\/]tweetnacl[\\\/]/, /[\\\/]tweetnacl-auth[\\\/]/],
    },
    resolve: {
        extensions: ['.vue', '.js', '.ts', '.css'],
        alias: {
            'vue-json-tree-view': path.resolve(
                __dirname,
                'shared/public/VueJsonTreeView/index.ts'
            ),
            'three-legacy-gltf-loader': path.resolve(
                __dirname,
                'shared/public/three-legacy-gltf-loader/LegacyGLTFLoader.js'
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
            appShell: '/player.html',
            AppCache: false,
            ServiceWorker: {
                events: true,
                entry: path.resolve(__dirname, 'shared', 'sw.ts'),
            },
            cacheMaps: [
                {
                    match: function(url) {
                        if (url.searchParams.has('dataPortal')) {
                            return url;
                        }
                    },
                    requestTypes: ['navigate'],
                },
            ],
            externals: [],
        }),
        new CopyPlugin([
            {
                from: 'node_modules/@webxr-input-profiles/assets/dist/profiles',
                to: path.resolve(__dirname, 'dist', 'webxr-profiles'),
                context: path.resolve(__dirname, '..', '..', '..'),
            },
        ]),
        new CopyPlugin([
            {
                from: path.resolve(__dirname, 'shared', 'public', 'draco'),
                to: path.resolve(__dirname, 'dist', 'gltf-draco'),
            },
        ]),
    ],
};
