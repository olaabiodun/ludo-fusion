const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  three: path.resolve(__dirname, 'node_modules/three'),
};

config.resolver.sourceExts.push('cjs');

module.exports = config;
