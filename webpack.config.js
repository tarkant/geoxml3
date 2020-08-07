const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: { main: './src/index.ts' },
  resolve: {
    extensions: ['.ts','.js'],
  },
  devtool: 'source-map',
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
      })
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',
    libraryTarget: 'umd',
    library: 'GeoXML3',
    umdNamedDefine: true,
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.(t|j)s?$/,
        exclude: /node_modules/,
        use: {
          loader: 'awesome-typescript-loader?module=es6',
        }
      }
    ]
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 3000,
  },
};