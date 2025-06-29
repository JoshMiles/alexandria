const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
  {
    mode: 'production',
    entry: {
      main: './src/index.tsx',
      startup: './src/startup.tsx',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        chunks: ['main'],
      }),
      new HtmlWebpackPlugin({
        template: './src/startup.html',
        filename: 'startup.html',
        chunks: ['startup'],
      }),
    ],
    performance: {
      hints: false,
      maxAssetSize: 512000,
      maxEntrypointSize: 512000,
    },
  },
  {
    mode: 'production',
    entry: './backend/libgen-api.ts',
    target: 'electron-main',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'backend.js',
      library: {
        type: 'commonjs2',
      },
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-typescript'],
            },
          },
        },
      ],
    },
  },
  {
    mode: 'production',
    entry: './preload.js',
    target: 'electron-preload',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'preload.js',
    },
    resolve: {
      extensions: ['.js'],
    },
  },
];
