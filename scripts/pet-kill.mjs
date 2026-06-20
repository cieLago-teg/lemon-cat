import { spawnSync } from "node:child_process";

const shellHint = "desktop-pet-shell";
const findRootPidsScript = `
$ErrorActionPreference = "SilentlyContinue"
$roots = @(
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and
    ($_.Name -in @('electron.exe', 'node.exe')) -and
    $_.CommandLine -like '*${shellHint}*' -and
    $_.CommandLine -notlike '*--type=*'
  } |
    Sort-Object ProcessId -Unique |
    Select-Object -ExpandProperty ProcessId
)
if ($roots.Count -eq 0) {
  Write-Output "none"
} else {
  Write-Output ($roots -join ",")
}
`;

function runPowerShell(script) {
  return spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    stdio: "pipe",
    encoding: "utf-8",
    windowsHide: true
  });
}

try {
  const rootsResult = runPowerShell(findRootPidsScript);
  if (rootsResult.status !== 0) {
    process.stderr.write(rootsResult.stderr || "pet-kill failed");
    process.exitCode = rootsResult.status ?? 1;
  } else {
    const raw = (rootsResult.stdout || "").trim();
    const rootPids =
      raw && raw !== "none"
        ? raw
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [];

    if (rootPids.length === 0) {
      process.stdout.write("killed:none\n");
    } else {
      const killed = [];
      const failed = [];
      for (const pid of rootPids) {
        const taskkill = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
          stdio: "pipe",
          encoding: "utf-8",
          windowsHide: true
        });
        if (taskkill.status === 0) {
          killed.push(pid);
        } else {
          failed.push(pid);
        }
      }

      if (failed.length > 0) {
        process.stdout.write(`partial:${killed.join(",")};failed:${failed.join(",")}\n`);
      } else {
        process.stdout.write(`killed:${killed.join(",")}\n`);
      }
    }
  }
} catch (e) {
  process.stderr.write(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
}
