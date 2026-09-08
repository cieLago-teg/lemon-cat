# 2026-09-08 1A 用户隔离：双账号隔离端到端测试（针对运行中的 dev server）。
# 用法：先 npm run dev，再 powershell -ExecutionPolicy Bypass -File scripts/auth-isolation-test.ps1
$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:3000"
$envFile = Join-Path $PSScriptRoot "..\.env.1a.local"
$invite = (Get-Content $envFile | Select-String "^REGISTRATION_CODE=").Line -replace "^REGISTRATION_CODE=", ""
$legacyPass = (Get-Content $envFile | Select-String "^LEGACY_PASSWORD=").Line -replace "^LEGACY_PASSWORD=", ""
$stamp = Get-Date -Format "HHmmss"
$emailA = "test-a-$stamp@lemoncat.local"
$emailB = "test-b-$stamp@lemoncat.local"
$pass = "test-password-123456"

$jarA = Join-Path $env:TEMP "lemoncat-jarA.txt"
$jarB = Join-Path $env:TEMP "lemoncat-jarB.txt"
$jarL = Join-Path $env:TEMP "lemoncat-jarL.txt"
Remove-Item $jarA, $jarB, $jarL -ErrorAction SilentlyContinue

# JSON body 走临时文件，避免 PowerShell/curl 转义地狱。
function JsonFile($obj) {
  $f = [System.IO.Path]::GetTempFileName()
  $obj | ConvertTo-Json -Depth 6 | Set-Content -Path $f -Encoding UTF8
  return $f
}

# -w 写状态码，body 输出到文件再读。
function Api($method, $path, $jar, $bodyObj) {
  $bodyFile = if ($null -ne $bodyObj) { JsonFile $bodyObj } else { $null }
  $outFile = [System.IO.Path]::GetTempFileName()
  $codeFile = [System.IO.Path]::GetTempFileName()
  $curlArgs = @("-s", "-X", $method, "$base$path",
    "-H", "Origin: $base", "-o", $outFile, "-w", "%{http_code}")
  if ($jar) { $curlArgs += @("-b", $jar, "-c", $jar) }
  if ($bodyFile) { $curlArgs += @("-H", "Content-Type: application/json", "--data-binary", "@$bodyFile") }
  $code = (& curl.exe @curlArgs | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0) { throw "curl exit $LASTEXITCODE" }
  $code = "$code".Trim()
  $bodyText = [System.IO.File]::ReadAllText($outFile)
  Remove-Item $outFile, $codeFile -ErrorAction SilentlyContinue
  if ($bodyFile) { Remove-Item $bodyFile -ErrorAction SilentlyContinue }
  return @{ code = [int]$code; body = $bodyText }
}

$passCount = 0; $failCount = 0
function Check($name, $cond, $detail) {
  if ($cond) { $script:passCount++; Write-Output "PASS  $name  $detail" }
  else { $script:failCount++; Write-Output "FAIL  $name  $detail" }
}

# 1. 未登录 -> 401
$r = Api GET "/api/archive" $null $null
Check "未登录访问列表" ($r.code -eq 401) "=> $($r.code)"

# 2. 注册 A / B（带各自的 jar 保存 set-cookie）
$rA = Api POST "/api/auth/register" $jarA @{ email = $emailA; password = $pass; inviteCode = $invite }
$rB = Api POST "/api/auth/register" $jarB @{ email = $emailB; password = $pass; inviteCode = $invite }
Check "注册 A" ($rA.code -eq 200 -and $rA.body -match "user") "=> $($rA.code)"
Check "注册 B" ($rB.code -eq 200 -and $rB.body -match "user") "=> $($rB.code)"

# 3. A 初始列表为空
$r = Api GET "/api/archive" $jarA $null
$listA = $r.body | ConvertFrom-Json
Check "A 初始档案列表" ($r.code -eq 200 -and @($listA.archives).Count -eq 0) "=> $($r.code), $(@($listA.archives).Count) 条"

# 4. A 创建档案
$r = Api POST "/api/archive" $jarA @{
  petName = "隔离测试小橘"; petVibe = "活泼"; aiTags = @("橘猫"); customFeatures = "";
  deployedAt = 0; lastSummonedAt = 0; needsFix = $false;
  results = @(@{ style = "watercolor"; imageUrl = "https://example.com/x.png"; prompt = "test" })
}
$created = $r.body | ConvertFrom-Json
$archiveId = $created.archive.id
Check "A 创建档案" ($r.code -eq 200 -and $archiveId -and $created.archive.ownerId) "id=$archiveId ownerId=$($created.archive.ownerId)"

# 5. A 读自己的档案
$r = Api GET "/api/archive/$archiveId" $jarA $null
Check "A 读自己档案" ($r.code -eq 200) "=> $($r.code)"

# 6. B 列表看不到 A 的档案
$r = Api GET "/api/archive" $jarB $null
$listB = $r.body | ConvertFrom-Json
Check "B 列表隔离" ($r.code -eq 200 -and @($listB.archives).Count -eq 0) "=> $(@($listB.archives).Count) 条 (预期 0)"

# 7. B 直接访问 A 的档案 ID -> 404
$r = Api GET "/api/archive/$archiveId" $jarB $null
Check "B 访问 A 档案被拒" ($r.code -eq 404) "=> $($r.code)"

# 8. legacy 登录能看到 17 份迁移档案
$r = Api POST "/api/auth/login" $jarL @{ email = "legacy@lemoncat.local"; password = $legacyPass }
Check "legacy 登录" ($r.code -eq 200) "=> $($r.code)"
$r = Api GET "/api/archive" $jarL $null
$listL = $r.body | ConvertFrom-Json
Check "legacy 账号档案" (@($listL.archives).Count -eq 17) "=> $(@($listL.archives).Count) 条 (预期 17)"

# 9. B 删 A 的档案 -> 404
$r = Api DELETE "/api/archive/$archiveId" $jarB $null
Check "B 删除 A 档案被拒" ($r.code -eq 404) "=> $($r.code)"

# 10. 登出后 cookie 失效
$r = Api POST "/api/auth/logout" $jarA @{}
Check "A 登出" ($r.code -eq 200) "=> $($r.code)"
$r = Api GET "/api/archive" $jarA $null
Check "登出后会话失效" ($r.code -eq 401) "=> $($r.code)"

# 11. 登录页可达且渲染
$outFile = [System.IO.Path]::GetTempFileName()
$code = (& curl.exe -s -o $outFile -w "%{http_code}" "$base/login" | Select-Object -First 1)
$pageCode = [int]"$code".Trim()
$page = [System.IO.File]::ReadAllText($outFile)
Check "登录页渲染" ($pageCode -eq 200 -and $page -match "欢迎回来|加入柠檬树苗") "=> HTTP $pageCode"
Remove-Item $outFile -ErrorAction SilentlyContinue

Write-Output ""
Write-Output "结果: $passCount 通过, $failCount 失败"
if ($failCount -gt 0) { exit 1 }
