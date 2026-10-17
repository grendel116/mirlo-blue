// Exports the web app into docs/app, with the GitHub Pages base path applied
const { execSync } = require("child_process");
const fs = require("fs");

execSync("npx expo export -p web --clear --output-dir docs/app", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, MIRLO_WEB_EXPORT: "1" },
});
fs.copyFileSync("docs/app/index.html", "docs/404.html");
