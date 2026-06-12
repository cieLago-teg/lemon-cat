export const TARGET_PROCESS_NAMES = [
  "electron.exe",
  "node.exe",
  "cmd.exe",
  "powershell.exe",
  "pwsh.exe",
  "npm.exe"
];

function toPowerShellSingleQuoted(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

export function buildKillScript(shellHint) {
  const hint = toPowerShellSingleQuoted(shellHint);
  const names = TARGET_PROCESS_NAMES.map(toPowerShellSingleQuoted).join(", ");

  return `
$ErrorActionPreference = "SilentlyContinue"
$shellHint = ${hint}.ToLowerInvariant()
$targetNames = @(${names})

function Is-TargetProcess($proc) {
  if (-not $proc) { return $false }
  if ([int]$proc.ProcessId -eq $PID) { return $false }
  if (-not $proc.Name) { return $false }
  if (-not $proc.CommandLine) { return $false }
  $name = $proc.Name.ToLowerInvariant()
  if ($targetNames -notcontains $name) { return $false }
  return $proc.CommandLine.ToLowerInvariant().Contains($shellHint)
}

$roots = @(Get-CimInstance Win32_Process | Where-Object { Is-TargetProcess $_ })
if (-not $roots -or $roots.Count -eq 0) {
  Write-Output "killed:none"
  return
}

$allCandidates = @(Get-CimInstance Win32_Process | Where-Object {
  $_.Name -and
  [int]$_.ProcessId -ne $PID -and
  ($targetNames -contains $_.Name.ToLowerInvariant())
})

$tracked = [System.Collections.Generic.HashSet[int]]::new()
$queue = [System.Collections.Generic.Queue[int]]::new()

foreach ($proc in $roots) {
  $pid = [int]$proc.ProcessId
  if ($tracked.Add($pid)) {
    $queue.Enqueue($pid)
  }
}

while ($queue.Count -gt 0) {
  $parentId = $queue.Dequeue()
  $children = @($allCandidates | Where-Object { [int]$_.ParentProcessId -eq $parentId })
  foreach ($child in $children) {
    $childId = [int]$child.ProcessId
    if ($tracked.Add($childId)) {
      $queue.Enqueue($childId)
    }
  }
}

$killList = @($allCandidates | Where-Object { $tracked.Contains([int]$_.ProcessId) } | Sort-Object ProcessId -Descending)
foreach ($proc in $killList) {
  Stop-Process -Id $proc.ProcessId -Force
}

$deadline = (Get-Date).AddSeconds(8)
do {
  Start-Sleep -Milliseconds 250
  $remaining = @(
    Get-CimInstance Win32_Process | Where-Object {
      $tracked.Contains([int]$_.ProcessId) -and (Is-TargetProcess $_)
    }
  )
} while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline)

if ($remaining.Count -gt 0) {
  Write-Output ("timed_out:" + (($remaining | Select-Object -ExpandProperty ProcessId) -join ","))
} else {
  Write-Output ("killed:" + (($killList | Select-Object -ExpandProperty ProcessId) -join ","))
}
`;
}
