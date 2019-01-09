const childProcess = require('child_process');
const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const webpack = require('webpack');

const commitHash = childProcess.execSync('git rev-parse HEAD').toString().trim();

module.exports = {
  entry: path.resolve(__dirname, 'index.ts'),
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /formula\-lib/,
        use: 'raw-loader'
      },
      {
        test: /\.vue$/,
        use: 'vue-loader',
        exclude: /node_modules/
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['vue-style-loader', 'css-loader'],
      },
      {
        test: /\.svg$/,
        use: 'vue-svg-loader'
      },
      {
        test: /von-grid.min.js$/,
        use: 'exports-loader?vg=vg'
      },
      {
        test: /\.(png|jpg|gif|gltf)$/,
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
      'three-examples': path.join(__dirname, '../node_modules/three/examples/js'),
      'fs': 'browserfs',
      'formula-lib': path.join(__dirname, '../common/Formulas/formula-lib.ts')
    }
  },
  plugins: [
    new CleanWebpackPlugin([
      path.resolve(__dirname, 'dist')
    ]),
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: 'WebClient/index.html',
      title: 'File Simulator'
    }),
    new webpack.ProvidePlugin({
      THREE: 'three',
    }),
    new webpack.DefinePlugin({
      GIT_HASH: JSON.stringify(commitHash)
    })
  ]
};