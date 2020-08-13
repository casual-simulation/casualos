const path = require('path');
const merge = require('webpack-merge');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const common = require('./webpack.common.js');

module.exports = merge.smart(common, {
    mode: 'production',
    devtool: 'source-map',
    output: {
        filename: pathData => {
            return pathData.chunk.name === 'deno'
                ? '[name].js'
                : '[name].[contenthash].js';
        },
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
                            minimize: true,
                        },
                    },
                ],
            },
            {
                test: /\.m?js/,
                include: /(astring|lru\-cache|yallist|monaco\-editor)/, // NPM modules that use ES6 and need to be transpiled
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
        new webpack.HashedModuleIdsPlugin(),
    ],
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                parallel: true,
                sourceMap: true,
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
        splitChunks: {
            cacheGroups: {
                monaco: {
                    test: /[\\/](node_modules|public)[\\/]monaco-editor/,
                    name: 'monaco',
                    chunks: 'all',
                    priority: 1,
                },
                vendor: {
                    test: /[\\/](node_modules|public)[\\/](?!aux-common)/,
                    name: 'vendors',
                    chunks: 'all',
                    priority: 0,
                },
            },
        },
    },
});
