const merge = require('webpack-merge');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'production',
    devtool: false,
    optimization: {
        minimize: true,
        minimizer: [new UglifyJsPlugin()]
    }
});