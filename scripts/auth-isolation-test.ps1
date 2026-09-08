# 复用维护中的双账号 HTTP 验收，不依赖存量账号密码或固定档案数。
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
  npm run check:http
  if ($LASTEXITCODE -ne 0) { throw "HTTP verification failed: $LASTEXITCODE" }
} finally {
  Pop-Location
}
