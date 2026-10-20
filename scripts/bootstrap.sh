#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required." >&2
  exit 1
fi

major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$major" -lt 20 ]; then
  echo "Node.js ${major} is too old. Use 20 or newer." >&2
  exit 1
fi

npm install
npm run compile
printf '\nLocal chain:  npm run chain\nDeploy:       npm run deploy\nWeb app:      npm run dev\nFull stack:   bash scripts/dev.sh\n'
