# Inter USDC bridge

The Swap tab now contains Swap and Bridge modes; the home screen also has a Bridge shortcut. Transfers in home activity and full history show a large currency logo next to Sent or Received. Tower swaps retain the Tower logo; bridges and approvals have their own classification.

## Supported routes

| Environment | Arc network | Other network | Directions |
| --- | --- | --- | --- |
| Mainnet | Arc, 5042 | Base, 8453 | Into and out of Arc |
| Testnet | Arc Testnet, 5042002 | Base Sepolia, 84532 | Into and out of Arc |

Only USDC and same-environment routes are supported. Tokens must be held at the same Inter wallet address on the source chain. The first release has no external-wallet source connection or custom destination address.

## Execution and recovery

Tower's authenticated Node RPC supplies route checks, balances, estimates, simulation, transaction submission, and receipts. Circle CCTP V2 supplies the USDC burn/mint contracts and attestations. This implementation does **not** execute Tower's `/api/public/bridge` REST operation: its documented contract does not provide the local-wallet unsigned transaction and recovery interfaces Inter needs.

The user reviews the source/destination, exact USDC amount, and gas estimates. Inter approves only that amount if necessary, burns USDC with a zero destination caller, zero maximum protocol fee, and finalized threshold 2000, then saves progress while Circle attests. The user confirms a second transaction using Receive USDC when settlement is ready. PIN authorization follows Inter's existing security setting.

Keep native gas at the Inter address on both chains: USDC on Arc, ETH on Base. Arc native gas uses 18 decimals while ERC-20 USDC uses 6. Estimates reserve execution gas; Base's additional L1 data fee can affect the final charge. Standard CCTP has no protocol fee on the verified routes. Base-to-Arc finalization can take about 15–25 minutes; Arc-to-Base typically takes a few minutes. RPC, finality, or Circle outages can extend these times.

Each signed approval/burn/mint payload and its computed hash are saved **before** broadcasting. Lost responses and reloads preserve the exact transaction. Retry the same transaction resends identical bytes and never creates another burn. Pending operations survive history caps. Tracking checks source and destination receipts and validates every attested route, amount, sender, recipient, fee, and finality before signing. A reverted destination transaction retains the burn for another receive attempt. Do not clear site/extension data while a bridge is pending: this storage contains its recovery record.

Only a successful destination receipt or consumed validated CCTP nonce marks a bridge complete. A source receipt alone remains pending. If someone else completes the mint, the bridge can recognize completion from the nonce without knowing that person's destination transaction hash.

## Tower setup

Use Node 22+ and configure the ignored `.env` using `.env.example`:

```dotenv
TOWER_API_KEY=<server-side Tower credential>
TOWER_ALLOWED_ORIGINS=http://localhost:5173,https://localhost,chrome-extension://<extension-id>
```

Tower's read scope covers Node RPC, including locally signed raw transaction submission; swap quote/build endpoints need its swaps scope. No wallet private key leaves Inter. The previous browser-embedded Tower key has been removed; replace any credential that was included in old public builds.

`npm run dev` serves `/api/tower` through Vite. Do not use `VITE_TOWER_API_KEY`; Vite variables are public. The proxy permits four chain IDs, specific RPC methods, and supported swap endpoints, with request-size, rate, and concurrency limits.

For Vercel web hosting, `api/tower/[...path].mjs` deploys alongside the Vite app. Set `TOWER_API_KEY` and any extension/Android origins in the **server** environment. Same-origin web builds leave `VITE_TOWER_PROXY_URL` empty. Existing deployments need a new build with these settings; this change does not deploy itself.

For another Node host, run `npm run tower:serve` behind HTTPS and forward `/api/tower/*` to port 8787 (or `TOWER_PORT`). Set `VITE_TOWER_PROXY_URL=https://<proxy-host>` before building a separately hosted frontend. `GET /api/tower/health` reports whether the server credential is configured without returning it.

Extension and Android builds must set the public `VITE_TOWER_PROXY_URL` to the HTTPS web/proxy origin, and add their exact origins to `TOWER_ALLOWED_ORIGINS`. Android's configured origin is `https://localhost`; Chrome uses `chrome-extension://<extension-id>`. The release workflows now read the GitHub repository variable `VITE_TOWER_PROXY_URL` instead of injecting a Tower secret.

Inter's production proxy is `https://interwallet.vercel.app`. Distributed unpacked extension installs can opt in to `chrome-extension://*` in the server allowlist: this permits valid Chrome extension IDs while continuing to reject other web origins. Exact IDs remain supported for installations where they are known.

## Activity migration

Canonical history keys are `inter_wallet_txs_v2_<chainId>_<lowercaseAddress>`. Polling, recorded transactions, spender metadata, notifications, and explorer links all use the selected network. Delayed responses from a previous wallet/network cannot update the active history.

Old mainnet caches migrate only into mainnet. Old testnet caches already contained untagged mainnet rows, so only explicitly testnet-tagged rows are imported. The original caches remain intact; genuine testnet activity repopulates from the testnet explorer/RPC. Bigint token and block values are restored when loading persisted records.

Testnet swaps now use real Tower quotes and network-specific transactions; the old fabricated testnet quotes and success hashes have been removed. Uniswap V4 routing remains mainnet-only.

## Validation

Run:

```bash
npm run check
npm run test:bridge
npm run build
npm run build:extension
npm run cap:sync
```

Regression tests cover wallet/chain isolation, contaminated legacy caches, route separation, tampered CCTP messages, preserved signed transaction identities, currency/Tower icons, vault PIN compatibility, and the proxy's credentials, allowed methods/origins, and Vercel parsed bodies.

Browser checks used Playwright CLI at 390×844 with a disposable local wallet. `tests/browser-history-isolation.js` checks currency logos, network switching, and delayed mainnet polls. `tests/browser-bridge-flow.js` mocks all bridge RPC/attestation responses and exercises stale estimates after amount/network changes, PIN authorization, exact approval, persist-before-broadcast, lost burn response, reload, identical-byte retry, settlement wait, numeric receiving-fee review, and successful destination confirmation. Start with an unlocked disposable wallet on mainnet for the history script, then run the bridge script on testnet. The bridge script assumes its disposable wallet uses PIN 123456; never run these storage fixtures in a funded or personal wallet session.

```bash
playwright-cli -s=<isolated-session> run-code --filename=tests/browser-history-isolation.js
playwright-cli -s=<isolated-session> run-code --filename=tests/browser-bridge-flow.js
```

All four route estimates were checked against live Tower RPC and Circle fee data using read-only requests. No live burn, mint, or funded-wallet settlement was performed.
