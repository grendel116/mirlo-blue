// The web player loads the minified hls.js bundle, which ships without its own types.
// It is the same library as "hls.js", so it takes that package's types.
declare module "hls.js/dist/hls.min.js" {
  import Hls from "hls.js";
  export default Hls;
}
