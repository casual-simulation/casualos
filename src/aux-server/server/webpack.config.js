const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  devtool: 'none',
  entry: path.resolve(__dirname, 'index.ts'),
  target: 'node',
  node: {
    __filename: false,
    __dirname: false
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /formula\-lib/,
        use: 'raw-loader'
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        include: [/aux-common/, __dirname],
        options: { allowTsInNodeModules: true },
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
    alias: { },
    symlinks: false
  },
  externals: [
    // TODO:
    // There's some weirdness going on where some
    // packages aren't getting symlinked into node_modules
    // and so nodeExternals doesn't know to exclude those
    // packages from the build
    nodeExternals({
      whitelist: /^aux-common/
    })
  ], // in order to ignore all modules in node_modules folder
  plugins: [
    new webpack.ContextReplacementPlugin(
      /socket\.io/,
      /socket\.io-client/
    ),
    new webpack.ContextReplacementPlugin(
      /express/,
      /express/
    )
  ]
};