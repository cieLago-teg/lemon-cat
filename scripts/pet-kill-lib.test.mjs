import test from "node:test";
import assert from "node:assert/strict";

import { TARGET_PROCESS_NAMES, buildKillScript } from "./pet-kill-lib.mjs";

test("kill helper targets the whole shell launcher family", () => {
  assert.deepEqual(TARGET_PROCESS_NAMES, [
    "electron.exe",
    "node.exe",
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
    "npm.exe"
  ]);
});

test("kill helper waits for matching shell processes to exit", () => {
  const script = buildKillScript("desktop-pet-shell");

  assert.match(script, /desktop-pet-shell/i);
  assert.match(script, /electron\.exe/i);
  assert.match(script, /node\.exe/i);
  assert.match(script, /\$PID/);
  assert.match(script, /Stop-Process/i);
  assert.match(script, /Start-Sleep/i);
  assert.match(script, /timed_out:/i);
});
