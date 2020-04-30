const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const path = require('path');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
});
