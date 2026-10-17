// The web app is hosted under /mirlo-blue/app on GitHub Pages. Only the web export sets that
// base path (scripts/buildWeb.js); Android bundles keep their default asset paths.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.MIRLO_WEB_EXPORT ? { baseUrl: "/mirlo-blue/app" } : {}),
  },
});
