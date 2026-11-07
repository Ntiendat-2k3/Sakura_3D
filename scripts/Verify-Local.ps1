# Safe local checks, no installations or data modification.
$ErrorActionPreference = 'Continue'
Write-Host '== Tools ==' -ForegroundColor Cyan
foreach ($name in @('node','pnpm','docker','git','codex')) {
  $found = Get-Command $name -ErrorAction SilentlyContinue
  if ($found) { Write-Host "PASS $name -> $($found.Source)" }
  else { Write-Warning "$name not found in PATH" }
}
$root = Split-Path -Parent $PSScriptRoot
Write-Host '== Project config ==' -ForegroundColor Cyan
foreach ($file in @('.env','pnpm-workspace.yaml','package.json','apps/web/package.json','apps/api/package.json','apps/world-server/package.json')) {
  if (Test-Path (Join-Path $root $file)) { Write-Host "PASS $file" }
  else { Write-Warning "MISSING $file" }
}
Write-Host '== Endpoints (after pnpm dev) ==' -ForegroundColor Cyan
foreach ($url in @('http://localhost:4000/api/v1/health','http://localhost:4000/api/v1/zones')) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    Write-Host "PASS $url ($($response.StatusCode))"
  } catch { Write-Warning "UNAVAILABLE $url" }
}

try { $tcp = [System.Net.Sockets.TcpClient]::new("127.0.0.1", 2567); $tcp.Close(); Write-Host "PASS world-server TCP port 2567" } catch { Write-Warning "UNAVAILABLE world-server TCP port 2567" }
