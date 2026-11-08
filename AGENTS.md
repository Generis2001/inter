# Inter

> Built by Generis2001

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Inter is a self-custodial Arc wallet for USDC/EURC transfers, swaps, activity, Arc names, and USDC bridging into and out of Arc on mainnet and testnet.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: local viem account from an encrypted vault; PIN/password unlock and optional transaction PIN. Do not substitute an injected wallet flow.
- Chains: Arc Mainnet (5042) and Arc Testnet (5042002), selected by `NetworkContext`.
- Tokens: USDC/ERC-20 (6 decimals), native gas USDC (18 decimals), and EURC (6 decimals). Use the network-specific token registry.
- Bridge: Arc ↔ Base (8453), Arc Testnet ↔ Base Sepolia (84532), via locally signed Circle CCTP V2 and Tower RPC. Standard settlement needs a manually confirmed receiving transaction and gas on both networks.
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)
- `src/context/BridgeContext.tsx` - signing and durable bridge recovery, mounted above screens
- `src/services/cctp.ts` - CCTP route/fee checks and attestation validation
- `src/utils/bridgeHistory.ts` - persist signed transaction/hash before broadcast; retries must use identical bytes
- `src/utils/transactionHistory.ts` - wallet + actual chain ID history; never read untagged mainnet records into testnet
- `server/tower-proxy.mjs`, `server/tower-handler.mjs`, `api/tower/` - server-only Tower credential and explicit Node/Vercel proxy routes
- `docs/bridge-implementation.md` - supported routes, setup, limitations, and validation

## To Run

```bash
bun install
bun run dev
```

`npm install` / `npm run dev` also work. Validate with `npm run check`, `npm run test:bridge`, and `npm run build`. Tower requires server-side `TOWER_API_KEY`; never put a secret in a `VITE_` variable. Extension/Android builds need `VITE_TOWER_PROXY_URL` pointing to the deployed proxy and an allowed origin.

`src/onchain-facts.ts` is generated; do not edit it by hand. Supplement missing facts in feature modules and verify them against official documentation/live read-only contracts.
