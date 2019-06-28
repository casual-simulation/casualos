const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'development',
    devtool: false,
    plugins: [
        new webpack.SourceMapDevToolPlugin({
            filename: '[name].js.map',
            publicPath: 'http://localhost:3000/',
        }),
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(false),
        }),
    ],
});
