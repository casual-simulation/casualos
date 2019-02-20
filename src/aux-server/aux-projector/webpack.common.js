const childProcess = require('child_process');
const path = require('path');
const process = require('process');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const OfflinePlugin = require('offline-plugin');
const webpack = require('webpack');

const commitHash = childProcess.execSync('git rev-parse HEAD').toString().trim();
const latestTag = childProcess.execSync('git describe --abbrev=0 --tags').toString().trim();

module.exports = {
  entry: path.resolve(__dirname, 'index.ts'),
  output: {
    publicPath: '/',
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
        loader: 'ts-loader',
        include: [/aux-common/, __dirname],
        options: { allowTsInNodeModules: true }
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
      'three-examples': path.join(__dirname, '../node_modules/three/examples/js'),
      'webxr-polyfill': path.resolve(__dirname, 'public/scripts/webxr-polyfill.js'),
    },
    symlinks: false
  },
  plugins: [
    new CleanWebpackPlugin([
      path.resolve(__dirname, 'dist')
    ]),
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html'),
      title: 'File Simulator'
    }),
    new webpack.ProvidePlugin({
      THREE: 'three',
    }),
    new webpack.DefinePlugin({
      GIT_HASH: JSON.stringify(commitHash),
      GIT_TAG: JSON.stringify(latestTag),
      SENTRY_DSN: JSON.stringify(process.env.SENTRY_DSN),
    }),
    new OfflinePlugin({
      appShell: '/',
      AppCache: false,
      ServiceWorker: {
        events: true
      },
      externals: [
        'https://fonts.googleapis.com/css?family=Roboto:400,500,700,400italic|Material+Icons'
      ]
    })
  ]
};