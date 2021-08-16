const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');

module.exports = merge(common, {
    mode: 'development',
    plugins: [
        new webpack.DefinePlugin({
            DEVELOPMENT: JSON.stringify(true),
            ENDPOINT: JSON.stringify('http://dynamodb:8000'),
        }),
    ],
});
