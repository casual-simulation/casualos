const childProcess = require('child_process');
const path = require('path');
const process = require('process');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const webpack = require('webpack');
const { merge } = require('webpack-merge');

const commitHash = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .trim();
const latestTag = childProcess
    .execSync('git describe --abbrev=0 --tags')
    .toString()
    .trim();

module.exports = {
    player: playerConfig(),
    deno: denoConfig(),
};

function playerConfig() {
    return merge(baseConfig(), {
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
            sw: path.resolve(__dirname, './shared/sw.ts'),
        },
        plugins: [
            new CleanWebpackPlugin({
                cleanOnceBeforeBuildPatterns: [],
            }),
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
            ...commonPlugins(),
            new WorkboxPlugin.GenerateSW({
                clientsClaim: true,
                skipWaiting: true,
                exclude: [/webxr-profiles/, /\.map$/, /fonts\/NotoSansKR/],
                chunks: ['player', 'vendors', 'vm'],
                maximumFileSizeToCacheInBytes: 3145728, // 3MiB
                importScriptsViaChunks: ['sw'],
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from:
                            'node_modules/@webxr-input-profiles/assets/dist/profiles',
                        to: path.resolve(__dirname, 'dist', 'webxr-profiles'),
                        context: path.resolve(__dirname, '..', '..', '..'),
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'shared',
                            'public',
                            'draco'
                        ),
                        to: path.resolve(__dirname, 'dist', 'gltf-draco'),
                    },
                ],
            }),
        ],
    });
}

function denoConfig() {
    return merge(baseConfig(), {
        entry: {
            deno: path.resolve(
                __dirname,
                '..',
                '..',
                'aux-vm-deno',
                'vm',
                'DenoAuxChannel.worker.js'
            ),
        },
        plugins: [...commonPlugins()],
    });
}

function commonPlugins() {
    return [
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),
            PROXY_CORS_REQUESTS: process.env.PROXY_CORS_REQUESTS !== 'false',
        }),
    ];
}

function baseConfig() {
    return {
        output: {
            publicPath: '/',
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist'),
        },
        node: {
            global: true,
            __filename: 'mock',
            __dirname: 'mock',
        },
        module: {
            rules: [
                {
                    test: /\.worker(\.(ts|js))?$/,
                    use: [
                        {
                            // loader: 'worker-loader',
                            loader: path.resolve(
                                __dirname,
                                '../loaders/worker-loader/cjs.js'
                            ),
                            options: {
                                inline: 'fallback',
                            },
                        },
                    ],
                    exclude: /node_modules/,
                },
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
                    include: [
                        __dirname,
                        path.resolve(__dirname, '..', 'shared'),
                    ],
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
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
                    test: /\.(png|jpg|gif|gltf|glb|webp)$/,
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
                    use: {
                        loader: 'imports-loader',
                        options: {
                            imports: ['namespace three THREE'],
                        },
                    },
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
                    use: [
                        {
                            loader: 'exports-loader',
                            options: {
                                type: 'commonjs',
                                exports: 'single globalThis.nacl',
                            },
                        },
                        {
                            loader: 'imports-loader',
                            options: {
                                wrapper: {
                                    thisArg: 'globalThis',
                                    args: {
                                        module: '{}',
                                        require: 'false',
                                    },
                                },
                            },
                        },
                    ],
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
    };
}
