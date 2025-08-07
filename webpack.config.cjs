const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  target: 'electron-renderer',
  mode: 'production', // Changed to production for better optimization
  entry: './src/app.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    // Help webpack resolve tensorflow dependencies
    fallback: {
      "fs": false,
      "path": false,
      "crypto": false
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
  ],
  optimization: {
    usedExports: true,
    sideEffects: false,
    // Better tree shaking for TensorFlow
    providedExports: true,
  },
  externals: {
    // Keep TensorFlow as external to avoid bundling - loaded dynamically if available
    '@tensorflow/tfjs-core': 'commonjs @tensorflow/tfjs-core',
    '@tensorflow/tfjs-backend-cpu': 'commonjs @tensorflow/tfjs-backend-cpu',
    '@tensorflow-models/universal-sentence-encoder': 'commonjs @tensorflow-models/universal-sentence-encoder'
  },
  // Add webpack define plugin to enable conditional builds
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    })
  ],
  devtool: false, // Disable source maps for smaller builds
};
