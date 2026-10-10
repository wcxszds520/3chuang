param([int]$WebPort = 14734)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'web-dashboard'
$envFile = Join-Path $backendDir '.env'
if (!(Test-Path -LiteralPath $envFile)) {
  throw 'backend/.env is missing. Restore the project configuration before starting; do not silently use example credentials.'
}
$apiPort = 3000
$portLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*PORT\s*=\s*[0-9]+\s*$' } | Select-Object -Last 1
if ($portLine) { $apiPort = [int](($portLine -split '=', 2)[1].Trim()) }
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$logDir = Join-Path $projectRoot 'artifacts/local-review-runtime'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Start-LocalService($port, $serviceDir, $arguments, $name) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
    Write-Host "$name already listens on port $port; leaving the existing process unchanged."
    return
  }
  Start-Process -FilePath $nodeExe -ArgumentList $arguments -WorkingDirectory $serviceDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "$name.stdout.log") `
    -RedirectStandardError (Join-Path $logDir "$name.stderr.log") | Out-Null
}

# Keep the configured database. This launcher never seeds, migrates or resets it.
Start-LocalService $apiPort $backendDir @('server.js') 'backend'
$previousTarget = $env:PORTCUBE_API_TARGET
try {
  $env:PORTCUBE_API_TARGET = "http://127.0.0.1:$apiPort"
  Start-LocalService $WebPort $frontendDir @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', "$WebPort", '--strictPort') 'frontend'
} finally {
  $env:PORTCUBE_API_TARGET = $previousTarget
}
Write-Host "Review: http://127.0.0.1:$WebPort/workspace"
Write-Host "API: http://127.0.0.1:$apiPort/api/capabilities"
Write-Host "Startup requested. Check the capability endpoint and logs in $logDir for actual readiness."
