const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    'auth-service': './src/auth-service.ts',
    'user-service': './src/user-service.ts',
    'content-service': './src/content-service.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  target: 'web',
  externals: /k6(\/.*)?/
};
