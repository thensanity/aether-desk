$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$chain = Start-Process -FilePath "npm" -ArgumentList @("run", "chain") -PassThru -WindowStyle Hidden

try {
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $body = '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
      Invoke-WebRequest -Uri "http://127.0.0.1:8545" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Out-Null
      $ready = $true
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if (-not $ready) {
    throw "Hardhat node did not open port 8545."
  }
  npm run deploy
  npm run dev
} finally {
  if ($chain -and -not $chain.HasExited) {
    taskkill /PID $chain.Id /T /F | Out-Null
  }
}
