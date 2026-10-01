# link_builddirs.ps1 -- relocate heavy native build dirs to E: via directory junctions.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/link_builddirs.ps1 [-App <app dir>]
#   (tools/android_env_setup.sh calls it as step 4 for the default app)
#
# WHY (measured 2026-10-01)
#   D: hit 100% while the native builds (Skia / reanimated / worklets / expo-modules-core:
#   C++ + CMake + ninja) need several GB of intermediates. The failures do NOT look like
#   disk problems:
#     - "fatal error: error in backend: IO failure on output stream: No space left on device"
#     - "ninja: error: manifest 'build.ninja' still dirty after 100 tries"   (CMake cannot
#       write its own outputs, so it re-generates forever)
#   E: has 800G+ free. The script also PRINTS the free space of the working drive: making the
#   real cause visible early is the whole point.
#
# WHICH DIRS GET LINKED (and which must NOT)
#   ONLY build outputs: `<app>/android/{build,.gradle}`, `<app>/android/app/build`, and every
#   native module's `<module>/android/{build,.cxx}`.
#
#   *** node_modules ITSELF MUST STAY A REAL DIRECTORY ON THE WORKING DRIVE. ***
#   Two measured reasons:
#     1. `npm install` REPLACES a junctioned node_modules with a real directory
#        ("Removing non-directory ...node_modules") -- so the junction does not survive.
#     2. Worse, a junctioned node_modules makes different tools disagree about the path:
#        node resolves the REAL path (E:) while Gradle/Expo autolinking reports the junction
#        path (D:), and RN codegen then fails with
#        "this and base files have different roots: E:\... and D:\...".
#   With node_modules real and only build dirs linked, the roots stay consistent
#   (that is how the first successful Skia build ran).
#
# ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 as the system ANSI codepage
# (GBK here) unless there is a BOM. UTF-8 Chinese without a BOM gets mis-decoded, and the
# decoder can emit a stray quote byte that silently ends a string literal -- the parse error
# then points somewhere else entirely ("Unexpected token 'ok]'"). Hit that twice.

param(
  [string]$App = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot          # parent of tools/ == repo root
if ([string]::IsNullOrEmpty($App)) { $App = Join-Path $Root 'examples\apps\todo-app\host' }
if (-not (Test-Path $App)) { throw "app dir not found: $App" }

$Build = 'E:\moobile-build'
$slug = (Split-Path -Leaf $App)
$targetRoot = Join-Path $Build ("builddirs-" + $slug)
New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

function Get-FreeGB([string] $drive) {
  $d = Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction SilentlyContinue
  if ($d) { return [math]::Round($d.Free / 1GB, 2) }
  return -1
}

# ---- explicit: app-level Gradle outputs -------------------------------------
$pairs = @(
  @{ Link = (Join-Path $App 'android\app\build'); Target = (Join-Path $targetRoot 'android_app_build') },
  @{ Link = (Join-Path $App 'android\build');     Target = (Join-Path $targetRoot 'android_root_build') },
  @{ Link = (Join-Path $App 'android\.gradle');   Target = (Join-Path $targetRoot 'android_dot_gradle') }
)

# ---- discovered: every native module's CMake / Gradle build dir -------------
# Signal: a directory named `android` that contains `build.gradle`.
# Junctions are created EAGERLY (even when build/.cxx do not exist yet): those are exactly the
# outputs that must land on E:, and by the time Gradle creates them the parent is back on D:.
# A discovery-only version missed the module that had not been built yet (that is how the
# second failure happened: expo-modules-core's .cxx was never junctioned).
$nm = Join-Path $App 'node_modules'
if (Test-Path $nm) {
  $androidDirs = Get-ChildItem -Path $nm -Recurse -Directory -Force -ErrorAction SilentlyContinue |
                 Where-Object { $_.Name -eq 'android' -and (Test-Path (Join-Path $_.FullName 'build.gradle')) }
  foreach ($a in $androidDirs) {
    foreach ($sub in @('build', '.cxx')) {
      $link = Join-Path $a.FullName $sub
      $rel = $link.Substring($nm.Length + 1)
      $safe = ($rel -replace '[\\/]', '__') -replace '[^A-Za-z0-9_.\-]', '_'
      $pairs += @{ Link = $link; Target = (Join-Path $targetRoot $safe) }
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
    & robocopy $link $target /MOVE /E /XJ /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if (Test-Path $link) { Remove-Item -LiteralPath $link -Recurse -Force }
  }
  New-Item -ItemType Junction -Path $link -Target $target | Out-Null
  $lines += "[fix] " + $link + "  ->  " + $target
}

Write-Output '=== result'
$lines | ForEach-Object { Write-Output ("  " + $_) }
$fixed = @($lines | Where-Object { $_.StartsWith('[fix]') }).Count
$junctions = @($lines | Where-Object { $_.StartsWith('[ok]') -or $_.StartsWith('[fix]') }).Count
$free = Get-FreeGB 'D'
Write-Output ("  (app: " + $App + ")")
Write-Output ("  (" + $junctions + " junction(s), " + $fixed + " new; targets under " + $targetRoot + ")")
Write-Output ("  free space on D:: " + $free + " GB" + $(if ($free -ge 0 -and $free -lt 5) { "   <-- LOW: native builds need several GB; that is why build outputs live on E:" } else { "" }))
