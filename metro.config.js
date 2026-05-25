const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve and serve .wasm files (required by expo-sqlite web support)
config.resolver.assetExts.push('wasm');

module.exports = config;
