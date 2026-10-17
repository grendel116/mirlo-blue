const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.transformer.assetPlugins = [
  ...(config.transformer.assetPlugins ?? []),
  path.resolve(__dirname, "plugins/vendorAssetPaths.js"),
];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    if (moduleName === "react-native-track-player") {
      return {
        filePath: path.resolve(__dirname, "shims/react-native-track-player.web.ts"),
        type: "sourceFile",
      };
    }
    if (moduleName === "@preeternal/react-native-cookie-manager") {
      return {
        filePath: path.resolve(__dirname, "shims/cookie-manager.web.ts"),
        type: "sourceFile",
      };
    }
    if (moduleName === "expo-secure-store") {
      return {
        filePath: path.resolve(__dirname, "shims/expo-secure-store.web.ts"),
        type: "sourceFile",
      };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
