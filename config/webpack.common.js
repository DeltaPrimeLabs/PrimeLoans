const path = require('path');
const paths = require('./paths')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

const VueLoaderPlugin = require('vue-loader-plugin');

module.exports = {
        // Where webpack looks to start building the bundle
        entry: ['whatwg-fetch', paths.src + '/main.js'],

        resolve: {
            extensions: ['.js', '.vue'],
            alias: {
                '@': path.resolve('src'),
                '@config': path.resolve('config'),
                '@contracts': path.resolve(`deployments/avalanche`),
                '@artifacts': path.resolve(`artifacts`),
                vue: 'vue/dist/vue.js'
            },
            fallback: {
                "stream": require.resolve("stream-browserify"),
                "https": require.resolve("https-browserify"),
                "console": require.resolve("console-browserify"),
                "zlib": require.resolve("browserify-zlib"),
                "http": require.resolve("stream-http")
            }
        },

        // Where webpack outputs the assets and bundles
        output: {
            path: paths.build,
            filename: '[name].bundle.js',
            publicPath: '/',
        },

        // Customize the webpack build process
        plugins: [

            // Vue plugin for the magic
            new VueLoaderPlugin(),

            // Removes/cleans build folders and unused assets when rebuilding
            new CleanWebpackPlugin(),

            // Copies files from target to destination folder
            new CopyWebpackPlugin([
                    {
                        from: paths.assets,
                        to: 'src/assets',
                        globOptions: {
                            ignore: ['*.DS_Store'],
                        },
                    },
                ]
            ),

            // Generates deprecation warning: https://github.com/jantimon/html-webpack-plugin/issues/1501
            new HtmlWebpackPlugin({
                title: 'webpack DeltaPrime',
                favicon: paths.src + '/assets/icons/deltaprime-logo.svg',
                template: paths.src + '/index.html', // template file
                filename: 'index.html', // output file
            }),

            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            })
        ],

        // Determine how modules within the project are treated
        module: {
            rules: [
                // JavaScript: Use Babel to transpile JavaScript files
                {
                    test: /\.vue$/,
                    loader: 'vue-loader'
                },
                {
                    test: /\.js$/,
                    include: /src/,
                    exclude: [/node_modules/, path.resolve(__dirname, '../tools')],
                    use: ['babel-loader']
                },
                // Styles: Inject CSS into the head with source maps
                {
                    test: /\.(scss|css)$/,
                    use: [
                        // Note: Only style-loader works for me !!!
                        // 'vue-style-loader',
                        'style-loader',
                        {loader: 'css-loader', options: {sourceMap: true, importLoaders: 1}},
                        {loader: 'postcss-loader', options: {sourceMap: true}},
                        {loader: 'sass-loader', options: {sourceMap: true}},
                    ],
                },

                // Images: Copy image files to build folder
                {test: /\.(?:ico|gif|png|jpg|jpeg)$/i, type: 'asset/resource'},

                // Fonts and SVGs: Inline files
                {test: /\.(woff(2)?|eot|ttf|otf|svg|)$/, type: 'asset/inline'},
            ],
        }
}