// Publishes exported package assets (like the icon fonts) under assets/vendor/
// instead of assets/node_modules/, a folder GitHub Pages never serves.
// Only exported builds carry `?export_path=`; the dev server keeps its own paths.
module.exports = function publishPackageAssetsAsVendor(assetData) {
  if (assetData.httpServerLocation.includes("?export_path=")) {
    assetData.httpServerLocation = assetData.httpServerLocation.replace(
      "/node_modules/",
      "/vendor/",
    );
  }
  return assetData;
};
