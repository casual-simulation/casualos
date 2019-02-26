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
        test: /\.tsx?$/,
        loader: 'ts-loader',
        include: [__dirname],
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.js', '.ts' ],
    alias: { },
  },
  externals: [
    nodeExternals({
      whitelist: /^@yeti-cgi\/aux-common/,
      
      // Use package.json instead of node_modules.
      // This way we can exclude packages even though they're not in the first node_modules
      // directory
      modulesFromFile: true 
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