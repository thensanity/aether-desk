$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20 or newer is required."
}

$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 20) {
  throw "Node.js $major is too old. Use 20 or newer."
}

npm install
npm run compile
Write-Host ""
Write-Host "Local chain:  npm run chain"
Write-Host "Deploy:       npm run deploy"
Write-Host "Web app:      npm run dev"
Write-Host "Full stack:   powershell -File scripts/dev.ps1"
