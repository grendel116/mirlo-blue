// Ships the current branch everywhere at once:
// 1. builds the web app into docs/app and commits it
// 2. pushes to GitHub, which publishes the web app on GitHub Pages
// 3. sends an over-the-air update to Android devices on the development channel
const { execSync } = require("child_process");

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit", shell: true });
}

function read(command) {
  return execSync(command, { encoding: "utf8", shell: true }).trim();
}

run("npm run build:web");

run("git add -A docs/app docs/404.html");
const webBuildChanged = read("git diff --cached --name-only -- docs/app docs/404.html") !== "";
if (webBuildChanged) {
  run('git commit -m "Update web app build" -- docs/app docs/404.html');
} else {
  console.log("\nWeb app build is unchanged.");
}

run("git push");

const message = read("git log -1 --format=%s -- . :!docs/app :!docs/404.html");
run(
  `npx --yes eas-cli@latest update --channel development --environment development --platform android --non-interactive --message ${JSON.stringify(message)}`,
);

console.log("\nPushed to GitHub, web app published, and development update sent.");
