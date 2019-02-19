const path = require('path');
const nodeExternals = require('webpack-node-externals');

const auxCommon = path.resolve(__dirname, '..', '..', 'aux-common');

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
        include: [__dirname],
        exclude: /node_modules/,
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        include: [auxCommon],
        exclude: /node_modules/,
        options: {
          instance: 'common',
          configFile: path.resolve(auxCommon, 'tsconfig.json')
        }
      },
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
    alias: {
      'aux-common/Formulas/formula-lib': path.resolve(__dirname, '..', '..', 'aux-common/Formulas/formula-lib.ts'),
    }
  },
  externals: [nodeExternals({
    whitelist: [ /^aux-common/ ]
  })], // in order to ignore all modules in node_modules folder
};