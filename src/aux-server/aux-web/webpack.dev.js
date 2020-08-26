const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const path = require('path');

const finalPlayerConfig = merge(common.player, developmentConfig());
const finalDenoConfig = merge(common.deno, developmentConfig());

module.exports = [finalPlayerConfig, finalDenoConfig];

function developmentConfig() {
    return {
        mode: 'development',
        devtool: false,
        plugins: [
            new webpack.SourceMapDevToolPlugin({
                filename: '[name].js.map',
                publicPath: '//localhost:3000/',
            }),
            new webpack.DefinePlugin({
                PRODUCTION: JSON.stringify(false),
            }),
            new HardSourceWebpackPlugin({
                environmentHash: {
                    root: process.cwd(),
                    directories: [],
                    files: [
                        path.resolve(
                            __dirname,
                            '..',
                            '..',
                            '..',
                            'package-lock.json'
                        ),
                        path.resolve(
                            __dirname,
                            '..',
                            '..',
                            '..',
                            'tsconfig.base.json'
                        ),
                        path.resolve(__dirname, '..', 'package.json'),
                        path.resolve(__dirname, '..', 'tsconfig.json'),
                        'package-lock.json',
                        'yarn.lock',
                    ],
                },
            }),
        ],
    };
}
