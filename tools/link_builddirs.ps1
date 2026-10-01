# link_builddirs.ps1 -- relocate every heavy native build dir to E: via directory junctions.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/link_builddirs.ps1
#   (tools/android_env_setup.sh calls it as step 4)
#
# WHY THIS EXISTS (measured 2026-09-21)
#   D: (238G) hit 100% with a few hundred MB free while the native builds (Skia / reanimated /
#   worklets / expo-modules-core: C++ + CMake + ninja) need several GB of intermediates.
#   The failures look NOTHING like "disk full":
#     - "fatal error: error in backend: IO failure on output stream: No space left on device"
#     - "ninja: error: manifest 'build.ninja' still dirty after 100 tries"   <-- this one is
#       really "CMake cannot write its own outputs", not a ninja bug.
#   E: has 800G+ free, so the artifacts belong there. That is why this script also PRINTS the
#   free space of the working drive: the whole point is to make the real cause visible early.
#
# WHY IT DISCOVERS INSTEAD OF LISTING
#   The first version hardcoded 9 paths and therefore missed
#   node_modules/expo/node_modules/expo-modules-core/android/.cxx -- the build then failed one
#   module later. "Discover, do not hardcode" is the same lesson as moobile-host build
#   (see tools/gen_forwarders.py's neighbours for the same reasoning).
#
# WHY JUNCTIONS (and not Gradle config)
#   Output paths are decided by Gradle / CMake / node_modules layout -- changing config would
#   touch many places, while "make this directory a link" is transparent to all of them.
#   CAVEAT: stop the Gradle daemon first (`./gradlew --stop`); it holds file handles there.
#
# WHY THIS FILE IS ASCII-ONLY
#   Windows PowerShell 5.1 reads .ps1 as the system ANSI codepage (GBK here) unless there is a
#   UTF-8 BOM. UTF-8 Chinese without a BOM gets mis-decoded, and the decoder can emit a stray
#   quote byte -- silently terminating a string literal and producing a parse error far from the
#   real cause ("Unexpected token 'ok]'"). ASCII avoids the whole class of problem.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot          # parent of tools/ == repo root
$AppHost = Join-Path $Root 'examples\apps\todo-app\host'
$Build = 'E:\moobile-build'
$WorkDrive = 'D:'

New-Item -ItemType Directory -Force -Path $Build | Out-Null

function Get-FreeGB([string] $drive) {
  $d = Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction SilentlyContinue
  if ($d) { return [math]::Round($d.Free / 1GB, 2) }
  return -1
}

# ---- explicit: app-level Gradle outputs -------------------------------------
$pairs = @(
  @{ Link = "$AppHost\android\app\build"; Target = "$Build\android_app_build" },
  @{ Link = "$AppHost\android\build";     Target = "$Build\android_root_build" },
  @{ Link = "$AppHost\android\.gradle";   Target = "$Build\android_dot_gradle" }
)

# ---- discovered: every native module's CMake / Gradle build dir -------------
# Signal: a directory named `android` that contains `build.gradle` -- that is a native
# module, not some JS folder that happens to be called "android".
#
# We create the junctions EAGERLY, even when build/.cxx do not exist yet: those are exactly
# the outputs that must land on E:, and by the time Gradle creates them the parent is back on
# D:. Discovery-only missed the module that had not been built yet -- that is precisely how
# the second failure happened (expo-modules-core's .cxx was never junctioned).
#
# NOTE: keep this file ASCII-only. See the header -- Chinese comments here get mis-decoded by
# Windows PowerShell 5.1 (GBK) and can swallow the NEXT line, which is how `$nm` ended up null.
$nm = Join-Path $AppHost 'node_modules'
if (Test-Path $nm) {
  $androidDirs = Get-ChildItem -Path $nm -Recurse -Directory -Force -ErrorAction SilentlyContinue |
                 Where-Object { $_.Name -eq 'android' -and (Test-Path (Join-Path $_.FullName 'build.gradle')) }
  foreach ($a in $androidDirs) {
    foreach ($sub in @('build', '.cxx')) {
      $link = Join-Path $a.FullName $sub
      $rel = $link.Substring($nm.Length + 1)
      $safe = ($rel -replace '[\\/]', '__') -replace '[^A-Za-z0-9_.\-]', '_'
      $pairs += @{ Link = $link; Target = (Join-Path $Build $safe) }
    }
  }
}

$lines = @()
foreach ($p in $pairs) {
  $link = $p.Link
  $target = $p.Target
  $parent = Split-Path -Parent $link
  if (-not (Test-Path $parent)) {
    $lines += "[--]  (parent missing, skipped) " + $link
    continue
  }
  $item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
  if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    $lines += "[ok]  already a junction: " + $link
    continue
  }
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  if ($item) {
    & robocopy $link $target /MOVE /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if (Test-Path $link) { Remove-Item -LiteralPath $link -Recurse -Force }
  }
  New-Item -ItemType Junction -Path $link -Target $target | Out-Null
  $lines += "[fix] " + $link + "  ->  " + $target
}

Write-Output '=== result'
$lines | ForEach-Object { Write-Output ("  " + $_) }
$fixed = @($lines | Where-Object { $_.StartsWith('[fix]') }).Count
$junctions = @($lines | Where-Object { $_.StartsWith('[ok]') -or $_.StartsWith('[fix]') }).Count
$free = Get-FreeGB $WorkDrive
Write-Output ("  (" + $junctions + " junction(s) total, " + $fixed + " new; target root: " + $Build + ")")
Write-Output ("  free space on " + $WorkDrive + ": " + $free + " GB" + $(if ($free -ge 0 -and $free -lt 5) { "   <-- LOW: native builds need several GB; that is why they live on E:" } else { "" }))
