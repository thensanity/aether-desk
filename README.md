# Aether Desk

Operations console for an Ethereum savings vault. The React app talks to the chain through one interface, implemented twice: once with ethers.js and once with web3.js. A Hardhat project deploys the vault, Docker serves the built UI, and an ECS task definition is the production shape on AWS.

The vault holds a test ERC-20 (`aUSD`). Deposits require a Merkle proof. The same tree code runs in the browser and in the deploy script, and the Solidity verifier uses the same leaf and pair hashes.

## Layout

```text
apps/web            React, Vite, ethers.js, web3.js
packages/merkle     Shared allowlist tree
contracts           SavingsVault, MockERC20, Hardhat tests
scripts             Unix and PowerShell setup
infra               ECS/Fargate task definition
```

`ChainClient` is the boundary. Screens never import a chain library directly. `createChainClient()` loads only the selected library, so the other one stays in its own bundle chunk. Reads and writes are ABI-encoded inside the adapter, then sent as raw transactions with an EIP-1559 fee cap.

The submission queue is a binary heap. Jobs created in the same turn are ordered before the first one reaches the wallet: pause, then allowlist updates, then withdrawals, then approvals, then deposits. The queue waits until the node accepts a transaction, not until it is mined, so the next pending nonce is already reserved.

RPC caching is an LRU, and it only stores stable calls such as `eth_chainId`. Balances are not cached. Recent vault logs sit in a fixed ring buffer, polled with a two-block overlap so a short reorg does not drop an event.

Runtime configuration is `apps/web/public/config.json`, fetched when the page loads. The container entrypoint rewrites that file from `CHAIN_ID`, `RPC_URL`, and `CLIENT`, which is how the same image moves from a laptop to ECS without a rebuild.

## EVM behavior covered

- Chain id, native balance, pending nonce, and `eth_getLogs`
- EIP-1559 base fee, priority fee, and a max fee with headroom for a rising base fee
- EIP-55 checksums
- Custom errors (`NotAllowlisted`, `Paused`, and the rest), decoded from revert data
- Checks-effects-interactions and a reentrancy lock in the vault
- Merkle allowlist: `keccak256(keccak256(abi.encode(address)))`, then sorted pairs
- Wallet connection over EIP-1193, including `wallet_switchEthereumChain`

`aUSD` is a deployer-minted test token. Do not treat it as a production currency. The vault has not been audited.

## Local setup

Requires Node.js 20 or newer. From the repository root, on Windows:

```powershell
powershell -File scripts/bootstrap.ps1
npm run chain
```

Leave that terminal open. In a second terminal:

```powershell
npm run deploy
npm run dev
```

Or start the node, deploy, and the dev server together:

```powershell
powershell -File scripts/dev.ps1
```

On Linux or macOS the same flow is `bash scripts/bootstrap.sh`, `bash scripts/dev.sh`, and the `make` targets `install`, `test`, `chain`, `deploy`, and `dev`.

The app is at `http://127.0.0.1:5173`. Default chain is Hardhat, id `31337`, RPC `http://127.0.0.1:8545`.

Import Hardhat account 0 into the wallet for a local session. This key is published in Hardhat's own docs and has value only on a local chain:

```text
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

That account is on the demo allowlist and receives 10,000 aUSD at deploy. Approve the vault, then deposit. The rail switches the live transport between ethers and web3.js. Overview can probe both and compare the head block.

For Sepolia, copy `.env.example` to `.env`, set `SEPOLIA_RPC_URL` and `DEPLOYER_KEY`, then `npm run deploy:sepolia`. Point `config.json` at chain id `11155111` and that RPC. Never commit the key.

## Tests

```powershell
npm test
```

That runs the Vitest suite (units, Merkle proofs, fee math, the transaction heap) and the Hardhat suite (deposit, rejection, withdraw, pause, owner controls). `npm run build` typechecks the app and produces the static bundle.

## Docker

```powershell
docker compose up --build
```

The UI is published on port `8080`. From inside the container, `127.0.0.1` is not your Hardhat node, so Compose points `RPC_URL` at `host.docker.internal`. `GET /healthz` returns `ok`.

## AWS

`scripts/aws-publish.sh` builds the image and pushes it to ECR. Set `AWS_ACCOUNT_ID`, `AWS_REGION`, and optionally `ECR_REPOSITORY` (default `aether-desk`). The script uses the default AWS CLI profile.

`infra/ecs-task-definition.json` is a Fargate task for that image: 0.25 vCPU, 512 MB, port 80, the same environment variables as the container entrypoint, and a container health check against `/healthz`. Replace `ACCOUNT_ID` and `REGION`, create the log group `/ecs/aether-desk`, and run it behind an Application Load Balancer or CloudFront. The task execution role needs the standard ECS pull and CloudWatch logs permissions. RPC URLs and chain ids are configuration, not image rebuilds.

A small production footprint is enough here: one stateless nginx task, no database, no keys in the image. Signing stays in the user's wallet.
