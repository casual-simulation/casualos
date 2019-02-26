const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'source-map',
    plugins: [
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(false),
            ENABLE_SENTRY: JSON.stringify(false)
        })
    ]
});