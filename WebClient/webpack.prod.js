const merge = require('webpack-merge');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'production',
    devtool: false,
    module: {
        rules: [
            {
                test: /\.m?js/,
                include: /(astring|lru\-cache|yallist|monaco\-editor)/, // NPM modules that use ES6 and need to be transpiled
                use: {
                    loader: 'babel-loader',
                    options: {
                    presets: ['@babel/preset-env'],
                    plugins: ['@babel/plugin-syntax-dynamic-import']
                    }
                }
            }
        ]
    },
    optimization: {
        minimize: true,
        minimizer: [new UglifyJsPlugin({
            parallel: true
        })]
    }
});