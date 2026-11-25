const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.resolve(projectRoot, "../billing")];

const withWind = withNativeWind(config, { input: "./src/global.css" });
const previousResolve = withWind.resolver.resolveRequest;
// Metro follows the Node export of jspdf, and that file loads html2canvas with a require the web bundler rejects.
withWind.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "jspdf") {
    return { type: "sourceFile", filePath: path.join(projectRoot, "node_modules/jspdf/dist/jspdf.es.min.js") };
  }
  if (previousResolve) return previousResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withWind;
