# Implementation Plan: inter — Continuation Pass

## Summary
Polish and complete the inter wallet app. Fix remaining copy issues, add live EUR/USD pricing for EURC, make outgoing sends appear in history immediately, and remove a duplicate API call in AssetsScreen.

## Architecture
- Blockchain: Arc Mainnet (chain ID 5042), viem + wagmi
- Wallet: in-memory BIP-39 / private-key accounts via WalletContext
- Frontend: React + Tailwind + framer-motion, all existing components

## Files to Create/Modify

1. `src/components/wallet/SettingsScreen.tsx` — fix em dash on address fallback line 69; fix wallet avatar showing hardcoded `'IN'` — use address slice or ANS name like the App.tsx header does
2. `src/hooks/useEurUsd.ts` (new) — fetch live EUR/USD rate from `https://open.er-api.com/v6/latest/EUR` (free, no key), cache for 5 minutes, return `{ rate: number, isLoading: boolean }`
3. `src/components/wallet/AssetsScreen.tsx` — add `useEurUsd` to show USD equivalent for EURC balance on the asset detail card; accept `transactions: ArcTransaction[]` as a prop instead of calling `useArcTransactions` again internally (removes duplicate API call)
4. `src/context/WalletContext.tsx` — add `pendingTxs: ArcTransaction[]` state and `addPendingTx(tx: ArcTransaction) / clearPendingTx(hash: string)` actions to the context value
5. `src/hooks/useArcTransactions.ts` — accept an optional `pendingTxs: ArcTransaction[]` parameter; merge them at the front of the returned list, deduplicated by hash; remove a pending entry once the explorer returns the same hash
6. `src/components/wallet/SendSheet.tsx` — after a successful `writeContract` / `sendTransaction`, call `addPendingTx` from WalletContext with the tx details so it appears in the dashboard immediately
7. `src/App.tsx` — pass `pendingTxs` from WalletContext into `useArcTransactions`; pass the merged `transactions` array down to `AssetsScreen` as a prop
8. `src/components/wallet/DashboardScreen.tsx` — no change needed (already receives `transactions` as prop)

## Build Sequence
1. Fix SettingsScreen em dash + avatar initials (one-line edits)
2. Create `useEurUsd` hook
3. Update WalletContext to hold `pendingTxs` + expose `addPendingTx` / `clearPendingTx`
4. Update `useArcTransactions` to accept and merge `pendingTxs`
5. Update SendSheet to call `addPendingTx` on success
6. Update AssetsScreen to accept `transactions` prop + use `useEurUsd` for EURC USD value
7. Update App.tsx to wire `pendingTxs` through
8. Run lint + typecheck — fix any errors

## Done When
- [ ] Zero em dashes anywhere in the UI copy
- [ ] EURC asset detail shows live USD equivalent (e.g. "≈ $1.08")
- [ ] A sent transaction appears in the dashboard activity list immediately after the send succeeds, before the explorer indexes it
- [ ] AssetsScreen no longer calls `useArcTransactions` internally — it uses the prop
- [ ] `bun run check` exits 0
