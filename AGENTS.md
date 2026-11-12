# Inter

> Built by Generis2001

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Inter is a self-custodial Arc wallet for USDC/EURC/cirBTC balances and transfers, stablecoin swaps, activity, Arc names, and USDC bridging into and out of Arc on mainnet and testnet. Its secondary-chain section shows Base ETH and USDC on mainnet, or Base Sepolia ETH and USDC on testnet.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: local viem account from an encrypted vault; PIN/password unlock and optional transaction PIN. Do not substitute an injected wallet flow.
- Chains: Arc Mainnet (5042) and Arc Testnet (5042002), selected by `NetworkContext`.
- Tokens: USDC/ERC-20 (6 decimals), native gas USDC (18 decimals), EURC (6 decimals), and cirBTC (8 decimals). Use the network-specific token registry. cirBTC uses different verified mainnet/testnet addresses; its CoinGecko logo is bundled in `src/assets/cirbtc.jpg`.
- Bridge: Arc ↔ Base (8453), Arc Testnet ↔ Base Sepolia (84532), via locally signed Circle CCTP V2 and Tower RPC. Standard settlement needs a manually confirmed receiving transaction and gas on both networks.
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/wallet/BottomNav.tsx` - Home, History, ANS, and Settings navigation; Swap and Bridge are Home shortcuts
- `src/components/shared/ScreenTransition.tsx`, `src/utils/motion.ts` - shared page transitions and motion timing, with reduced-motion support
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)
- `src/context/BridgeContext.tsx` - signing and durable bridge recovery, mounted above screens
- `src/hooks/useBridgeChainBalances.ts`, `src/components/wallet/SecondaryChainBalances.tsx` - shared, wallet/chain-scoped Base and Base Sepolia balances used by holdings and the bridge
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

Every production build refreshes `unpacked-extension/`. Local `INTER_EXTENSION_DIR` can mirror the build into an already installed unpacked Inter folder; keep its path and manifest key to preserve Chrome's extension identity and wallet storage. `npm run extension:watch` rebuilds/syncs on source changes; then Chrome's Reload button reads the updated files. This workspace's ignored local env points to the existing Windows installation, so builds need permission to write that directory outside the workspace sandbox.

`src/onchain-facts.ts` is generated; do not edit it by hand. Supplement missing facts in feature modules and verify them against official documentation/live read-only contracts.
