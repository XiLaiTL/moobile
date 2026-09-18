# Redirect Gradle per-project build outputs to E: via directory junctions.
# D: only has a couple of GB free, while an RN Android build needs several.
# Junctions are invisible to Gradle: it still writes to <project>/build.
#
# NOTE: keep ASCII-only (Windows PowerShell 5.1 reads .ps1 as ANSI).

$ErrorActionPreference = 'Continue'
# $PSScriptRoot = <module root>/_tools, so the host dir is derived, not hardcoded.
$root = Join-Path (Split-Path $PSScriptRoot -Parent) 'host'
$store = 'E:\moobile-build'

$targets = @(
  'android\build',
  'android\app\build',
  'node_modules\expo-modules-core\android\build',
  'node_modules\expo-modules-autolinking\build',
  'node_modules\expo-modules-autolinking\android\expo-gradle-plugin\build',
  'node_modules\@react-native\gradle-plugin\build',
  'node_modules\@react-native\gradle-plugin\react-native-gradle-plugin\build',
  'node_modules\@react-native\gradle-plugin\settings-plugin\build',
  'node_modules\@react-native\gradle-plugin\shared\build',
  'node_modules\@react-native\gradle-plugin\shared-testutil\build'
)

New-Item -ItemType Directory -Force -Path $store | Out-Null

foreach ($rel in $targets) {
  $link = Join-Path $root $rel
  $dest = Join-Path $store ($rel -replace '[\\/]', '_')

  $parent = Split-Path $link -Parent
  if (-not (Test-Path $parent)) { Write-Host ("skip (parent missing): " + $rel); continue }

  if (Test-Path $link) {
    $it = Get-Item $link -Force
    if ($it.LinkType) { Write-Host ("already a link, skip : " + $rel); continue }
    # A real directory may already exist from an earlier build; only replace it when empty.
    $left = Get-ChildItem -Force $link -ErrorAction SilentlyContinue
    if ($left) { Write-Host ("real dir not empty, skip: " + $rel); continue }
    Remove-Item -Force -Recurse $link -ErrorAction SilentlyContinue
  }

  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  New-Item -ItemType Junction -Path $link -Target $dest | Out-Null
  Write-Host ("junction OK: " + $rel + "  ->  " + $dest)
}

Write-Host ""
Write-Host "=== result"
foreach ($rel in $targets) {
  $link = Join-Path $root $rel
  if (Test-Path $link) {
    $it = Get-Item $link -Force
    $t = if ($it.LinkType) { $it.LinkType } else { 'plain dir' }
    Write-Host ("  [" + $t + "] " + $rel)
  } else {
    Write-Host ("  [none] " + $rel)
  }
}
