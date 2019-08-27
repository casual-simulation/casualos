const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const path = require('path');

module.exports = merge(common, {
    mode: 'development',
    plugins: [
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
});
