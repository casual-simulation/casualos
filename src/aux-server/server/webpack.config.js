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
        loader: 'ts-loader',
        include: [/aux-common/, __dirname],
        options: { allowTsInNodeModules: true }
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
    alias: {
      // 'aux-common/Formulas/formula-lib': path.resolve(__dirname, '..', '..', 'aux-common/Formulas/formula-lib.ts'),
    },
    symlinks: false
  },
  externals: [nodeExternals({
    whitelist: [ /^aux-common/ ]
  })], // in order to ignore all modules in node_modules folder
};