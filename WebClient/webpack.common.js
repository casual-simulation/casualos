const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const webpack = require('webpack');

module.exports = {
  entry: path.resolve(__dirname, 'index.ts'),
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        exclude: /node_modules/
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        loaders: ['style-loader', 'css-loader'],
      },
      {
        test: /\.svg$/,
        loader: 'vue-svg-loader'
      },
      {
        test: /von-grid.min.js$/,
        loader: 'exports-loader?vg=vg'
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {}
          }
        ]
      },
      {
        test: /three\/examples\/js/,
        use: 'imports-loader?THREE=three'
      }
    ]
  },
  resolve: {
    extensions: ['.vue', '.ts', '.js', '.css'],
    alias: {
      'von-grid': path.resolve(__dirname, 'public/von-grid.min.js'),
      'common': path.resolve(__dirname, '../common'),
      'three-examples': path.join(__dirname, '../node_modules/three/examples/js')
    }
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: 'WebClient/index.html',
      title: 'Process for Teams'
    }),
    new webpack.ProvidePlugin({
      THREE: 'three',
    })
  ]
};