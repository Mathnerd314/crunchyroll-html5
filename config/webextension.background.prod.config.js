const webpack = require("webpack");
const common = require('./webextension.background.config.js');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

common.plugins = [
  new UglifyJSPlugin()
];

module.exports = common;