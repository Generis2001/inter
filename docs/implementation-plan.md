Let me read the remaining files I haven't seen yet to find everything that needs fixing or finishing. Good — I have a full picture. Now I'll read the remaining files I haven't seen, then build: I have a thorough picture of the entire app. Now I'll build everything meaningful that's genuinely incomplete or improvable, without asking questions:

**What I'm fixing in this pass:**
1. **`SettingsScreen`** — still has an em dash (`'—'`) on line 69 for the address fallback
2. **`useArcTransactions`** — the polling hits the Blockscout-compatible explorer, but outgoing sends submitted through the app don't appear until the explorer indexes them (~30s delay). Fix: maintain a local pending-tx list in `WalletContext` that gets merged with the explorer results so sent txns show immediately
3. **`AssetsScreen`** — calls `useArcTransactions` a second time independently (doubles the API calls). Fix: accept `transactions` as a prop like `ActivityScreen` does
4. **Live USD price for EURC** — currently shows `€1.00` hardcoded. Fix: fetch EUR/USD rate from a free API and show real USD value
5. **`SendSheet`** — after a successful send, the local pending-tx should be added to context immediately
6. **UI polish** — the `SettingsScreen` wallet avatar shows `IN` hardcoded. Should use address initials or ANS name like the header does

Let me build all of this: I'm in Plan mode. I need to switch to Build mode to make any code changes. Here is the complete plan for this pass — approve it to build. You're currently in **Plan mode** — I can read files and plan but not write code. Switch to **Build mode** using the mode selector and I'll execute everything in one pass.

Here is exactly what will happen when you switch:

**8 changes, in order:**

1. **SettingsScreen** — remove the last em dash (`'—'` → `'Not connected'`), fix the hardcoded `'IN'` avatar to use address initials like the header does
2. **`useEurUsd` hook** (new file) — fetches live EUR/USD from `open.er-api.com` (free, no key), caches for 5 minutes, returns `{ rate, isLoading }`
3. **WalletContext** — adds `pendingTxs: ArcTransaction[]`, `addPendingTx()`, and `clearPendingTx()` — so a just-sent transaction can be injected into the list immediately
4. **`useArcTransactions`** — accepts optional `pendingTxs` and merges them at the front, deduplicated by hash; removes a pending entry once the explorer returns the same hash at `success`
5. **SendSheet** — calls `addPendingTx` right after a successful broadcast so the tx shows in the dashboard without waiting 30s for the explorer
6. **AssetsScreen** — accepts `transactions` as a prop instead of calling `useArcTransactions` itself (removes the duplicate fetch); EURC detail card shows `≈ $X.XX` using the live rate
7. **App.tsx** — wires `pendingTxs` into `useArcTransactions` and passes merged `transactions` to `AssetsScreen`
8. **Lint + typecheck** — `bun run check` exits 0
