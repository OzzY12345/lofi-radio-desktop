const { spawn } = require("node:child_process");

const electronBinary = require("electron");
const env = { ...process.env, VITE_DEV_SERVER_URL: "http://localhost:5173" };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  stdio: "inherit",
  env
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});