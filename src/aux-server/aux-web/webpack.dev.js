const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');

const finalPlayerConfig = merge(common.player, developmentConfig());
const finalDenoConfig = merge(common.deno, developmentConfig());

module.exports = [finalPlayerConfig, finalDenoConfig];

function developmentConfig() {
    return {
        mode: 'development',
        plugins: [
            new webpack.SourceMapDevToolPlugin({
                filename: '[name].js.map',
                publicPath: '//localhost:3000/',
            }),
            new webpack.DefinePlugin({
                PRODUCTION: JSON.stringify(false),
            }),
        ],
    };
}
