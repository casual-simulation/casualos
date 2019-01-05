const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
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
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
    alias: {
      'common': path.resolve(__dirname, '../common'),
      'formula-lib': path.join(__dirname, '../common/Formulas/formula-lib.ts')
    }
  },
  externals: [nodeExternals()], // in order to ignore all modules in node_modules folder
};