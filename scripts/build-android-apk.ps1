param(
  [string]$ApiBaseUrl = '',
  [bool]$DebugHttp = $true
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot 'frontend'
$androidDir = Join-Path $frontendDir 'android'
$releaseDir = Join-Path $frontendDir 'release'

function Resolve-JdkHome {
  if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    $verOut = & (Join-Path $env:JAVA_HOME 'bin\java.exe') -version 2>&1 | Out-String
    if ($verOut -match 'version "(17|21)\.') {
      return $env:JAVA_HOME
    }
  }

  $candidates = @()
  $candidates += @(Get-ChildItem "$env:USERPROFILE\.jdks" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(ms-21|temurin-17|corretto-21|corretto-17|openjdk-21|openjdk-17)' } | ForEach-Object { $_.FullName })
  $candidates += 'C:\Program Files\Android\Android Studio\jbr'
  $candidates += @(Get-ChildItem 'C:\Program Files\Java' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'jdk-(17|21)' } | ForEach-Object { $_.FullName })
  $candidates += @(Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'jdk-(17|21)' } | ForEach-Object { $_.FullName })

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path (Join-Path $candidate 'bin\java.exe'))) {
      return $candidate
    }
  }
  throw 'Không tìm thấy JDK 17 hoặc JDK 21. Vui lòng cài đặt JDK 17/21 hoặc đặt JAVA_HOME.'
}

function Resolve-AndroidSdk {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk"
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($candidate in $candidates) {
    return $candidate
  }
  throw 'Không tìm thấy Android SDK. Vui lòng đặt ANDROID_HOME hoặc cài Android SDK tại %LOCALAPPDATA%\Android\Sdk.'
}

$jdkHome = Resolve-JdkHome
$sdkHome = Resolve-AndroidSdk

$env:JAVA_HOME = $jdkHome
$env:ANDROID_HOME = $sdkHome
$env:ANDROID_SDK_ROOT = $sdkHome
$env:PATH = "$jdkHome\bin;$sdkHome\platform-tools;$env:PATH"

if ($ApiBaseUrl) {
  $env:VITE_API_BASE_URL = $ApiBaseUrl
}
$env:CAP_DEBUG_HTTP = if ($DebugHttp) { 'true' } else { 'false' }

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
Write-Host "Using ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "CAP_DEBUG_HTTP=$env:CAP_DEBUG_HTTP"

Push-Location $frontendDir
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build thất bại.' }

  if (-not (Test-Path $androidDir)) {
    npx cap add android
    if ($LASTEXITCODE -ne 0) { throw 'npx cap add android thất bại.' }
  }

  npx cap sync android
  if ($LASTEXITCODE -ne 0) { throw 'npx cap sync android thất bại.' }

  if ($DebugHttp) {
    $debugManifestDir = Join-Path $androidDir 'app\src\debug'
    New-Item -ItemType Directory -Force -Path $debugManifestDir | Out-Null
    $debugManifestPath = Join-Path $debugManifestDir 'AndroidManifest.xml'
    @'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:usesCleartextTraffic="true" />
</manifest>
'@ | Set-Content -Path $debugManifestPath -Encoding UTF8
  }

  Push-Location $androidDir
  try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleDebug thất bại.' }
  } finally {
    Pop-Location
  }

  $builtApk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
  if (-not (Test-Path $builtApk)) {
    throw "Không tìm thấy file APK tại $builtApk"
  }

  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
  $targetApk = Join-Path $releaseDir 'CVMikiri-debug.apk'
  Copy-Item -Path $builtApk -Destination $targetApk -Force

  $sizeMb = [Math]::Round((Get-Item $targetApk).Length / 1MB, 2)
  Write-Host "APK đã sẵn sàng: $targetApk ($sizeMb MB)"
} finally {
  Pop-Location
}
