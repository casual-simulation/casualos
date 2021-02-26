const path = require('path');
const {
    mergeWithRules,
    mergeWithCustomize,
    customizeArray,
} = require('webpack-merge');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const common = require('./webpack.common.js');
const childProcess = require('child_process');

const latestTag = childProcess
    .execSync('git describe --abbrev=0 --tags')
    .toString()
    .trim();

const mergeModule = mergeWithRules({
    rules: {
        test: 'match',
        use: 'replace',
    },
});

const merge = mergeWithCustomize({
    customizeArray: customizeArray({
        'plugins.*': 'append',
    }),
    customizeObject(a, b, key) {
        if (key === 'module') {
            return mergeModule(a, b);
        }

        return undefined;
    },
});

const finalPlayerConfig = merge(
    common.player(latestTag),
    productionPlayerConfig()
);
const finalDenoConfig = merge(common.deno(latestTag), productionDenoConfig());

module.exports = [finalPlayerConfig, finalDenoConfig];

function productionBaseConfig() {
    return {
        mode: 'production',
        devtool: 'source-map',
        output: {
            filename: (pathData) => {
                return pathData.chunk.name === 'deno'
                    ? '[name].js'
                    : '[name].[contenthash].js';
            },
            chunkFilename: '[name].[contenthash].chunk.js',
            path: path.resolve(__dirname, 'dist'),
        },
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                importLoaders: 1,
                            },
                        },
                    ],
                },
                {
                    test: /\.m?js/,
                    include: /(astring|lru\-cache|yallist)/, // NPM modules that use ES6 and need to be transpiled
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                            plugins: ['@babel/plugin-syntax-dynamic-import'],
                        },
                    },
                },
            ],
        },
        plugins: [
            new webpack.DefinePlugin({
                PRODUCTION: JSON.stringify(true),
            }),
            new MiniCssExtractPlugin({
                filename: '[name].[contenthash].css',
            }),
        ],
        optimization: {
            moduleIds: 'deterministic',
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    exclude: /deno\.js/,
                    parallel: true,
                    terserOptions: {
                        output: {
                            // Force ASCII characters so that Safari
                            // can load the worker blobs. (Safari loads them in ASCII mode)
                            ascii_only: true,
                        },
                    },
                }),
                new OptimizeCSSAssetsPlugin({}),
            ],
        },
    };
}

function productionDenoConfig() {
    return merge(productionBaseConfig(), {
        optimization: {
            splitChunks: false,
        },
    });
}

function productionPlayerConfig() {
    return merge(productionBaseConfig(), {
        optimization: {
            splitChunks: {
                cacheGroups: {
                    monaco: {
                        test: /[\\/](node_modules|public)[\\/]monaco-editor/,
                        name: 'monaco',
                        chunks: 'all',
                        priority: 1,
                    },
                    defaultVendors: {
                        test: /[\\/](node_modules|public)[\\/](?!aux-common)/,
                        name: 'vendors',
                        chunks: 'all',
                        priority: 0,
                    },
                },
            },
        },
    });
}
