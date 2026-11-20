// Starts Electron with ELECTRON_RUN_AS_NODE removed. VS Code's terminal sets
// that variable, which makes Electron behave like plain Node and fail.
// Usage: node launch.js [script]   (defaults to the app itself)
const { spawn } = require("node:child_process");
const electron = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [process.argv[2] || "."], { cwd: __dirname, env, stdio: "inherit" });
child.on("close", (code) => process.exit(code ?? 0));
