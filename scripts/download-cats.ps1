$ErrorActionPreference = 'Continue'
$base = 'https://cdn.jsdelivr.net/npm/live2d-widget-model-hijiki@1.0.5/assets'
$dir = 'd:\TRAE\柠檬树苗\public\models\free-cats\Hijiki'
$files = @(
  'moc/hijiki.moc',
  'moc/hijiki.2048/texture_00.png',
  'hijiki.pose.json',
  'mtn/00_idle.mtn',
  'mtn/01.mtn',
  'mtn/02.mtn',
  'mtn/03.mtn',
  'mtn/04.mtn',
  'mtn/05.mtn',
  'mtn/06.mtn',
  'mtn/07.mtn',
  'mtn/08.mtn'
)
foreach ($f in $files) {
  $out = Join-Path $dir $f
  $outDir = Split-Path $out
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  Write-Host "Downloading $f ..."
  curl.exe -L -s -o $out "$base/$f"
  $len = (Get-Item $out).Length
  Write-Host ("  -> {0} bytes" -f $len)
}
Write-Host "--- Hijiki done ---"