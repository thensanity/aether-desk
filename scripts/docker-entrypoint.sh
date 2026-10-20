#!/bin/sh
set -eu

CHAIN_ID="${CHAIN_ID:-31337}"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CLIENT="${CLIENT:-ethers}"

case "$CHAIN_ID" in
  ""|*[!0-9]*)
    echo "CHAIN_ID must be a positive integer" >&2
    exit 1
    ;;
esac

case "$CLIENT" in
  ethers|web3) ;;
  *)
    echo "CLIENT must be ethers or web3" >&2
    exit 1
    ;;
esac

case "$RPC_URL" in
  *\"*|*\\*)
    echo "RPC_URL must not contain quotes or backslashes" >&2
    exit 1
    ;;
esac

cat > /usr/share/nginx/html/config.json <<EOF
{"chainId": ${CHAIN_ID}, "rpcUrl": "${RPC_URL}", "client": "${CLIENT}"}
EOF

exec "$@"
