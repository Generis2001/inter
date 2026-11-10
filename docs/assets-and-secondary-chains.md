# Arc assets and secondary-chain balances

Inter's Home and Assets screens list USDC, EURC, and cirBTC on the active Arc network, followed by the Secondary chain section. Base ETH and USDC belong to the same Inter address used for bridging. Switching Arc environments also switches the secondary network and its balance cache.

The same local account controls that wallet address on Arc, Base, and their testnets. ETH and USDC on Base do not need separate receiving addresses. The secondary-chain section shows the full wallet address below the network name, with a button to copy it. Balances belong to a particular network, so receiving instructions must specify Base or Base Sepolia alongside the wallet address. A token contract address identifies the token deployment; it is separate from the user's receiving address and can differ between networks.

| Arc environment | cirBTC contract | Secondary network | Secondary USDC contract |
| --- | --- | --- | --- |
| Arc mainnet (5042) | `0x171a4217b86a807a64eb94757db6849fb4bdbaa0` | Base (8453) | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` |
| Arc Testnet (5042002) | `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` | Base Sepolia (84532) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Both cirBTC deployments were checked with live, read-only RPC calls on 10 November 2026. Each reports `Circle Wrapped Bitcoin`, symbol `cirBTC`, and 8 decimals. The mainnet address has no contract on Arc Testnet; use the separate deployment listed by [Circle's official contract directory](https://developers.circle.com/assets/cirbtc-contract-addresses). Base USDC addresses follow the existing bridge registry and [Circle's USDC contract directory](https://developers.circle.com/stablecoins/usdc-contract-addresses).

The official cirBTC logo was found by searching CIRBTC on CoinGecko, coin ID [`circle-wrapped-btc`](https://www.coingecko.com/en/coins/circle-wrapped-btc). Its Arc platform address and 8-decimal metadata match the live mainnet contract. The [CoinGecko image](https://coin-images.coingecko.com/coins/images/102172745/large/cirbtc.jpg?1775204071) is bundled locally as `src/assets/cirbtc.jpg`, so extension and mobile builds include it.

cirBTC balances and transfer amounts preserve all eight decimals, including a single satoshi. Send/Receive use the active network's contract; activity fetching tracks only that network's token addresses. Swaps remain USDC/EURC and the bridge remains USDC. The USD summary is explicitly scoped to Arc stablecoins; cirBTC and Base ETH display token quantities rather than an assumed dollar peg.

The secondary-chain section and bridge share `useBridgeChainBalances`, keyed by chain ID and wallet address. It checks the RPC network, reads USDC/native ETH and gas price through the existing server-side Tower proxy, polls every 20 seconds, and exposes a manual refresh. Bridge completion also invalidates these queries. Errors are displayed separately from genuine zero balances.

`npm run test:bridge` covers environment mapping, separate cirBTC deployments, and single-satoshi formatting. `tests/browser-secondary-balances.js` is a Playwright CLI fixture for a new disposable browser session: it mocks all RPCs and checks both secondary networks, the shared bridge source balance, cirBTC contract links/logo/history/transfer review, delayed responses during network switching, failed-read recovery, RPC chain mismatch handling, reloads, and mobile/desktop layouts. Run it through `playwright-cli -s=<isolated-session> run-code --filename=tests/browser-secondary-balances.js` against the development server. It creates only a disposable encrypted test vault and performs no broadcasts.
