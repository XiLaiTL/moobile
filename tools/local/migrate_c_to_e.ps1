# Move Android SDK / AVD data from C: to E:, leaving directory junctions behind.
# Junctions keep the original paths working, so adb / emulator / gradle / Expo
# need no configuration change.
#
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 as ANSI,
# so non-ASCII characters can corrupt string literals and break parsing.

$ErrorActionPreference = 'Continue'

function Move-ToE {
  param([string]$Src, [string]$Dst, [string]$Label)

  Write-Host ""
  Write-Host "=== $Label"
  Write-Host "    from : $Src"
  Write-Host "    to   : $Dst"

  if (-not (Test-Path $Src)) { Write-Host "    source missing, skip"; return }

  New-Item -ItemType Directory -Force -Path (Split-Path $Dst -Parent) | Out-Null

  if (Test-Path $Dst) {
    Write-Host "    destination already exists, skip copy (link only)"
  } else {
    robocopy $Src $Dst /E /MOVE /NFL /NDL /NJH /NJS /R:1 /W:1 /MT:16 | Out-Null
    $rc = $LASTEXITCODE
    Write-Host "    robocopy exit=$rc"
    if ($rc -ge 8) { Write-Host "    COPY FAILED, leaving source untouched"; return }
  }

  if (Test-Path $Src) {
    $left = Get-ChildItem -Force $Src -ErrorAction SilentlyContinue
    if ($left) {
      Write-Host "    source still has content, NOT removing and NOT linking"
      return
    }
    Remove-Item -Force -Recurse $Src -ErrorAction SilentlyContinue
  }

  New-Item -ItemType Junction -Path $Src -Target $Dst | Out-Null
  Write-Host "    OK: junction created"
}

Move-ToE -Src "$env:LOCALAPPDATA\Android\Sdk" -Dst "E:\Android\Sdk" -Label "Android SDK"
Move-ToE -Src "$env:USERPROFILE\.android" -Dst "E:\Android\dot-android" -Label "AVD data (.android)"
Move-ToE -Src "$env:USERPROFILE\.expo" -Dst "E:\Android\dot-expo" -Label "Expo cache (.expo)"

Write-Host ""
Write-Host "=== verify links"
foreach ($p in @("$env:LOCALAPPDATA\Android\Sdk", "$env:USERPROFILE\.android", "$env:USERPROFILE\.expo")) {
  if (Test-Path $p) {
    $it = Get-Item $p -Force
    $t = 'plain dir'
    if ($it.LinkType) { $t = $it.LinkType + ' -> ' + ($it.Target -join ',') }
    Write-Host ("  " + $p + "  [" + $t + "]")
  } else {
    Write-Host ("  " + $p + "  [MISSING]")
  }
}

Write-Host ""
Write-Host "=== key SDK files reachable via original path"
Write-Host ("  adb.exe       : " + (Test-Path "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"))
Write-Host ("  emulator.exe  : " + (Test-Path "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"))
Write-Host ("  ndk           : " + (Test-Path "$env:LOCALAPPDATA\Android\Sdk\ndk"))
Write-Host ("  system-images : " + (Test-Path "$env:LOCALAPPDATA\Android\Sdk\system-images"))
