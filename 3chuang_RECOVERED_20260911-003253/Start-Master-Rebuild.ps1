$ErrorActionPreference = 'Stop'
$runtime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (!(Test-Path -LiteralPath $runtime)) {
  $runtime = (Get-Command node -ErrorAction Stop).Source
}
$major = [int]((& $runtime -p 'process.versions.node.split(".")[0]').Trim())
if ($major -lt 20) { throw 'PORTCUBE requires Node.js 20 or newer for this launcher.' }
$occupied = Get-NetTCPConnection -State Listen -LocalPort 13000,14173 -ErrorAction SilentlyContinue
if ($occupied) {
  Write-Host 'Port 13000 or 14173 is already in use. No existing process was stopped.'
  Write-Host 'If PORTCUBE is already running, open http://127.0.0.1:14173/'
  $occupied | Select-Object LocalPort,OwningProcess | Format-Table
  return
}
Push-Location $PSScriptRoot
try {
  Write-Host 'PORTCUBE: http://127.0.0.1:14173/ | API: http://127.0.0.1:13000/api/health'
  Write-Host 'Uses an isolated database name. Authentication failures remain visible in the UI.'
  & $runtime (Join-Path $PSScriptRoot 'tools\master-start.mjs')
} finally {
  Pop-Location
}
