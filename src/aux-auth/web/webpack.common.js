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
const WebpackAssetsManifest = require('webpack-assets-manifest');

const commitHash = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .trim();

module.exports = {
    auth: authConfig,
};

function authConfig(latestTag) {
    return merge(baseConfig(), {
        entry: {
            site: path.resolve(__dirname, 'site', 'index.ts'),
            iframe: path.resolve(__dirname, 'iframe', 'index.ts'),
            // 'service-worker': path.resolve(
            //     __dirname,
            //     './shared/service-worker.ts'
            // ),
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
                chunks: ['site', 'vendors'],
                // inject: false,
                template: path.resolve(__dirname, 'site', 'index.html'),
                title: 'CasualOS.me',
                filename: 'index.html',
                favicon: path.resolve(__dirname, 'shared', 'favicon.ico'),
            }),
            new HtmlWebpackPlugin({
                chunks: ['iframe', 'vendors'],
                // inject: false,
                template: path.resolve(__dirname, 'iframe', 'index.html'),
                title: 'CasualOS.me',
                filename: 'iframe.html',
                favicon: path.resolve(__dirname, 'shared', 'favicon.ico'),
            }),
            ...commonPlugins(latestTag),
            new WorkboxPlugin.GenerateSW({
                clientsClaim: true,
                skipWaiting: true,
                exclude: [/\.map$/],
                include: [
                    /\.html$/,
                    /\.css$/,
                    /\.json$/,
                    /\.js$/,
                    /\.png$/,
                    /\.glb$/,
                    /\.ico$/,
                    /\.ttf$/,
                    /roboto-v18-latin-regular\.woff2$/,
                ],
                runtimeCaching: [],
                maximumFileSizeToCacheInBytes: 15728640, // 5MiB
                // importScriptsViaChunks: ['service-worker'],
                swDest: 'sw.js',
                inlineWorkboxRuntime: true,
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, 'shared', 'legal'),
                        to: path.resolve(__dirname, 'dist'),
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'shared',
                            'legal',
                            'terms-of-service.txt'
                        ),
                        to: path.resolve(__dirname, 'dist', 'terms'),
                        toType: 'file',
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'shared',
                            'legal',
                            'privacy-policy.txt'
                        ),
                        to: path.resolve(__dirname, 'dist', 'privacy-policy'),
                        toType: 'file',
                    },
                    {
                        from: path.resolve(
                            __dirname,
                            'shared',
                            'legal',
                            'acceptable-use-policy.txt'
                        ),
                        to: path.resolve(
                            __dirname,
                            'dist',
                            'acceptable-use-policy'
                        ),
                        toType: 'file',
                    },
                ],
            }),
        ],
    });
}

function commonPlugins(latestTag) {
    return [
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),

            // TODO: Add ability to customize this per build
            MAGIC_API_KEY: JSON.stringify('pk_live_A17F1F2BC229021E'),
        }),
    ];
}

function baseConfig() {
    return {
        output: {
            publicPath: '/',
            filename: '[name].js',
            chunkFilename: '[name].chunk.js',
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
                    include: [__dirname],
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
                    test: /\.(gltf|glb)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[contenthash].[name].[ext]',
                                outputPath: 'gltf',
                            },
                        },
                    ],
                },
                {
                    test: /\.(wasm)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[contenthash].[name].[ext]',
                                outputPath: 'wasm',
                            },
                        },
                    ],
                },
                {
                    test: /\.(png|jpg|gif|webp)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                // Required for images loaded via Vue code
                                esModule: false,
                                outputPath: 'images',
                            },
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
                os: false,
                constants: false,
                fs: false,
            },
        },
    };
}
