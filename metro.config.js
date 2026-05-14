const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force all 'three' imports to resolve to the project's root three package.
// This prevents "Multiple instances of Three.js" errors.
config.resolver.extraNodeModules = {
  three: path.resolve(__dirname, 'node_modules/three'),
};

// Also ensure we resolve .cjs files correctly if needed by R3F
config.resolver.sourceExts.push('cjs');

module.exports = config;
