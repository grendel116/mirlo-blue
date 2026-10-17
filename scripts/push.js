// Ships the current branch everywhere at once:
// 1. builds the web app into docs/app and commits it
// 2. pushes to GitHub, which publishes the web app on GitHub Pages
// 3. sends an over-the-air update to Android devices on the production channel
const { execSync } = require("child_process");

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit", shell: true });
}

function read(command) {
  return execSync(command, { encoding: "utf8", shell: true }).trim();
}

// The last commit that changed source: its subject and body describe what this push ships
const sourcePaths = "-- . :!docs/app :!docs/404.html";
const subject = read(`git log -1 --format=%s ${sourcePaths}`);
const body = read(`git log -1 --format=%b ${sourcePaths}`);

run("npm run build:web");

run("git add -A docs/app docs/404.html");
const webBuildChanged = read("git diff --cached --name-only -- docs/app docs/404.html") !== "";
if (webBuildChanged) {
  const commitMessage = `Rebuild web app: ${subject}`;
  run(`git commit -m ${JSON.stringify(commitMessage)} -- docs/app docs/404.html`);
} else {
  console.log("\nWeb app build is unchanged.");
}

run("git push");

// Update messages are one line, so the body's lines are joined after the subject
const message = [subject, ...body.split(/\r?\n/).filter(Boolean)].join(" | ");
run(
  `npx --yes eas-cli@latest update --channel production --environment production --platform android --non-interactive --message ${JSON.stringify(message)}`,
);

console.log("\nPushed to GitHub, web app published, and production update sent.");
