<#
.SYNOPSIS
  Automated Release Agent for Cutline Studio (YT Shorts Studio).
  Audits build + FFmpeg render checks, bumps SemVer across package.json,
  Cargo.toml, and tauri.conf.json, builds the Tauri Windows installer,
  commits & tags, and publishes a GitHub Release with assets attached.

.EXAMPLE
  .\scripts\release-agent.ps1 -Bump minor
  .\scripts\release-agent.ps1 -Bump patch
  .\scripts\release-agent.ps1 -Version 2.0.0
#>
param(
  [ValidateSet("patch", "minor", "major")]
  [string]$Bump = "patch",
  [string]$Version = "",
  [switch]$SkipChecks,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Ensure Rust cargo and MinGW windres are on PATH
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
  $env:PATH = "$cargoBin;$env:PATH"
}
if (-not (Get-Command windres -ErrorAction SilentlyContinue)) {
  $mingwCandidates = @(
    "C:\msys64\ucrt64\bin",
    "C:\msys64\mingw64\bin",
    "C:\mingw64\bin"
  ) + @(Get-ChildItem -Path "C:\Program Files\JetBrains\CLion*\bin\mingw\bin" -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
  foreach ($dir in $mingwCandidates) {
    if (Test-Path (Join-Path $dir "windres.exe")) {
      $env:PATH = "$dir;$env:PATH"
      break
    }
  }
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($msg) {
  Write-Host "`n==> $msg" -ForegroundColor Cyan
}

# 1. Verify tools
Step "Checking git, gh, node, and cargo"
git --version | Out-Null
gh auth status | Out-Null
cargo --version | Out-Null

# 2. Compute next version
$pkgPath = Join-Path $root "package.json"
$cargoPath = Join-Path $root "src-tauri\Cargo.toml"
$tauriPath = Join-Path $root "src-tauri\tauri.conf.json"

$pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
$currentVersion = [string]$pkgJson.version
if (-not ($currentVersion -match '^(\d+)\.(\d+)\.(\d+)$')) {
  throw "Unsupported version format in package.json: $currentVersion"
}

$maj = [int]$Matches[1]
$min = [int]$Matches[2]
$pat = [int]$Matches[3]

if ($Version) {
  if (-not ($Version -match '^\d+\.\d+\.\d+$')) {
    throw "Explicit -Version must be X.Y.Z (got: $Version)"
  }
  $nextVersion = $Version
} else {
  switch ($Bump) {
    "major" { $maj++; $min = 0; $pat = 0 }
    "minor" { $min++; $pat = 0 }
    "patch" { $pat++ }
  }
  $nextVersion = "$maj.$min.$pat"
}

$tag = "v$nextVersion"
Step "Release plan: $currentVersion -> $nextVersion ($tag)"

$existingTag = git tag -l $tag
if ($existingTag) {
  throw "Tag $tag already exists! Choose a higher version or bump level."
}

# 3. Run pre-release audit
if (-not $SkipChecks) {
  Step "Running TypeScript + Vite build check"
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

  Step "Running FFmpeg render_check suite"
  cargo run --manifest-path src-tauri/Cargo.toml --bin render_check
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg render_check failed" }
}

# 4. Bump versions across all 3 manifests
Step "Updating version to $nextVersion across package.json, Cargo.toml, and tauri.conf.json"

$pkgRaw = Get-Content $pkgPath -Raw
$pkgUpdated = [regex]::Replace($pkgRaw, '("version"\s*:\s*")\d+\.\d+\.\d+(")', "`${1}$nextVersion`${2}", 1)
[System.IO.File]::WriteAllText($pkgPath, $pkgUpdated, [System.Text.UTF8Encoding]::new($false))

$cargoRaw = Get-Content $cargoPath -Raw
$cargoUpdated = [regex]::Replace($cargoRaw, '(?m)^(version\s*=\s*")\d+\.\d+\.\d+(")', "`${1}$nextVersion`${2}", 1)
[System.IO.File]::WriteAllText($cargoPath, $cargoUpdated, [System.Text.UTF8Encoding]::new($false))

$tauriRaw = Get-Content $tauriPath -Raw
$tauriUpdated = [regex]::Replace($tauriRaw, '("version"\s*:\s*")\d+\.\d+\.\d+(")', "`${1}$nextVersion`${2}", 1)
[System.IO.File]::WriteAllText($tauriPath, $tauriUpdated, [System.Text.UTF8Encoding]::new($false))

# 5. Build Tauri release installer
Step "Building Tauri release executable & Windows NSIS installer"
npm run app:build
if ($LASTEXITCODE -ne 0) { throw "Tauri release build failed" }

$nsisDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
$installer = Get-ChildItem -Path $nsisDir -Filter "*_${nextVersion}_*-setup.exe" | Select-Object -First 1
if (-not $installer) {
  $installer = Get-ChildItem -Path $nsisDir -Filter "*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $installer) {
  throw "Could not find built NSIS installer in $nsisDir"
}
Write-Host "Found installer: $($installer.FullName) ($([math]::Round($installer.Length / 1MB, 2)) MB)" -ForegroundColor Green

# 6. Generate release notes from git log
$lastTag = (git tag --sort=-v:refname) | Select-Object -First 1
if ($lastTag) {
  $commits = (git log "${lastTag}..HEAD" --pretty=format:"- %s (%h)") -join "`n"
} else {
  $commits = (git log -n 20 --pretty=format:"- %s (%h)") -join "`n"
}

$notes = @"
## Cutline Studio $tag

### What's Changed
$commits

### Verification
- TypeScript & Vite production build verified
- FFmpeg end-to-end ``render_check`` suite passed (basic, composite, vertical, advanced FX/keyframes/shapes)
- Windows x64 NSIS installer built and attached
"@

if ($DryRun) {
  Step "DryRun enabled — skipping git commit, tag, push, and GitHub Release"
  Write-Host $notes
  exit 0
}

# 7. Commit, tag, push, and create GitHub Release
Step "Committing release $tag and pushing to origin"
git add -A
git commit -m "chore(release): $tag"
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

git tag -a $tag -m "Release $tag"
git push origin main
git push origin $tag

Step "Publishing GitHub Release $tag with installer asset"
$notesFile = Join-Path $env:TEMP "cutline-release-notes-$nextVersion.md"
[System.IO.File]::WriteAllText($notesFile, $notes, [System.Text.UTF8Encoding]::new($false))

gh release create $tag "$($installer.FullName)" `
  --title "Cutline Studio $tag" `
  --notes-file "$notesFile"

Remove-Item -Force $notesFile -ErrorAction SilentlyContinue

Step "Release $tag published successfully!"
gh release view $tag --json url --jq ".url"
