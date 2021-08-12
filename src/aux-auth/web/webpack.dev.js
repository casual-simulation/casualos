const webpack = require('webpack');
const {
    mergeWithCustomize,
    customizeArray,
    mergeWithRules,
} = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');

const mergeModule = mergeWithRules({
    rules: {
        test: 'match',
        use: {
            loader: 'match',
            options: 'replace',
        },
    },
});

const merge = mergeWithCustomize({
    customizeArray: customizeArray({
        'plugins.*': 'append',
    }),
    customizeObject(a, b, key) {
        if (key === 'module') {
            return mergeModule(a, b);
        }

        return undefined;
    },
});

const finalPlayerConfig = merge(
    common.auth('v9.9.9-dev:alpha', false),
    developmentConfig()
);

module.exports = [finalPlayerConfig];

function developmentConfig() {
    return {
        mode: 'development',
        devtool: 'eval-source-map',
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
