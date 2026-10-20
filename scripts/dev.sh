#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npm run chain &
chain_pid=$!

cleanup() {
  kill "$chain_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 40); do
  if curl -sf -X POST http://127.0.0.1:8545 \
    -H "content-type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "Hardhat node did not open port 8545." >&2
  exit 1
fi

npm run deploy
npm run dev
