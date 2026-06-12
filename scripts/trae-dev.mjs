import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, options) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: false,
    ...options
  });
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
}

function runLine(commandLine, options) {
  const child = spawn(commandLine, [], {
    stdio: "inherit",
    shell: true,
    windowsHide: false,
    ...options
  });
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
}

function startNext() {
  return run(npmCmd, ["run", "dev"], { cwd: rootDir });
}

function startPetShell() {
  spawnSync(process.execPath, [path.join(rootDir, "scripts", "pet-kill.mjs")], {
    cwd: rootDir,
    stdio: "ignore"
  });

  const shellDir = path.join(rootDir, "desktop-pet-shell");
  const nodeModulesDir = path.join(shellDir, "node_modules");
  if (!fs.existsSync(nodeModulesDir)) {
    return runLine(`${npmCmd} install && ${npmCmd} start`, { cwd: shellDir });
  }
  return run(npmCmd, ["start"], { cwd: shellDir });
}

const mode = process.argv[2] || "next";

if (mode === "next") {
  startNext();
} else if (mode === "shell") {
  startPetShell();
} else if (mode === "all") {
  startNext();
  startPetShell();
} else {
  process.stderr.write(`Unknown mode: ${mode}\n`);
  process.stderr.write("Usage: node scripts/trae-dev.mjs [next|shell|all]\n");
  process.exit(1);
}
