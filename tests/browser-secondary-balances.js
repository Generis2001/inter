/* oxlint-disable eslint/no-unused-expressions -- Playwright CLI expects a function expression. */
// Run in a new, empty Playwright CLI session. All RPCs are mocked; no transaction is broadcast.
async page => {
  page.setDefaultTimeout(15000);
  const metadata = await page.evaluate(async () => {
    const { accountFromPrivateKey } = await import('/src/utils/wallet.ts');
    const { saveVault } = await import('/src/utils/vault.ts');
    const { getTokens } = await import('/src/utils/tokens.ts');
    window.__interAssetTestViem = await import('/node_modules/.vite/deps/viem.js');
    const privateKey = '0x' + '11'.repeat(32);
    const account = accountFromPrivateKey(privateKey);
    const previous = localStorage.getItem('inter_wallet_vault_v1');
    if (previous && JSON.parse(previous).address.toLowerCase() !== account.address.toLowerCase()) {
      throw Error('Use a new disposable browser session for the secondary-balance fixture.');
    }
    await saveVault({ address: account.address, privateKey }, '123456');
    localStorage.setItem('inter_network_testnet', 'false');
    localStorage.setItem('inter_require_tx_pin', 'false');
    const other = '0x2222222222222222222222222222222222222222';
    for (const chainId of [5042, 5042002]) {
      const tx = { hash: '0x' + chainId.toString(16).padStart(64, '0'), from: other, to: account.address,
        value: '0.00', rawValue: '1', tokenSymbol: 'cirBTC', timestamp: Date.now(), status: 'success', direction: 'received',
        blockNumber: '16', gasUsed: '21000', txType: 'transfer', chainId };
      localStorage.setItem(`inter_wallet_txs_v2_${chainId}_${account.address.toLowerCase()}`, JSON.stringify([tx]));
    }
    return { wallet: account.address.toLowerCase(), tokens: { 5042: getTokens(5042), 5042002: getTokens(5042002) } };
  });
  const pad = raw => '0x' + BigInt(raw).toString(16).padStart(64, '0');
  const balances = {
    5042: { USDC: '50000000', EURC: '25000000', cirBTC: '12345678', native: '50000000000000000000' },
    5042002: { USDC: '7500000', EURC: '5500000', cirBTC: '1', native: '7500000000000000000' },
    8453: { USDC: '200123456', native: '123456780000000000' },
    84532: { USDC: '9750000', native: '876543210000000000' },
  };
  const secondaryUsdc = { 8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 84532: '0x036cbd53842c5426634e7929541ec2318f3dcf7e' };
  const requests = [];
  let delayBase = false;
  let failSecondary = false;
  let mismatchSecondary = false;
  const tokenValues = chainId => {
    const tokens = metadata.tokens[chainId] ?? [{ address: secondaryUsdc[chainId], symbol: 'USDC' }];
    return Object.fromEntries(tokens.map(token => [token.address.toLowerCase(), balances[chainId][token.symbol]]));
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/api/v2/addresses/')) { await route.fulfill({ json: { items: [] } }); return; }
    if (url.hostname === 'arcname.services') { await route.fulfill({ json: { status: 'not_found', verified: false, name: null } }); return; }
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    const chainId = url.pathname.includes('/api/tower/rpc/') ? Number(url.pathname.split('/').pop())
      : url.hostname.includes('testnet.arc.io') ? 5042002 : url.hostname.includes('mainnet.arc.io') ? 5042 : null;
    if (!chainId) { await route.abort(); return; }
    const payload = route.request().postDataJSON();
    const answer = async call => {
      requests.push({ chainId, method: call.method, params: call.params });
      let result;
      switch (call.method) {
        case 'eth_chainId': result = '0x' + (mismatchSecondary && chainId === 84532 ? 8453 : chainId).toString(16); break;
        case 'eth_getBalance':
          if (delayBase && chainId === 8453) await new Promise(resolve => setTimeout(resolve, 800));
          if (failSecondary && chainId === 84532) return { jsonrpc: '2.0', id: call.id, error: { code: -32000, message: 'Fixture balance read unavailable' } };
          result = '0x' + BigInt(call.params[0].toLowerCase() === metadata.wallet ? balances[chainId].native : '30000000000000000').toString(16);
          break;
        case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': result = '0x3b9aca00'; break;
        case 'eth_blockNumber': result = '0x10'; break;
        case 'eth_estimateGas': result = '0x7530'; break;
        case 'eth_getCode': result = '0x6000'; break;
        case 'eth_getLogs': result = []; break;
        case 'eth_call': {
          const callData = call.params[0].data;
          if (callData.startsWith('0x82ad56cb')) {
            result = await page.evaluate(({ data, amounts, wallet }) => {
              const viem = window.__interAssetTestViem;
              const decoded = viem.decodeFunctionData({ abi: viem.multicall3Abi, data });
              const values = decoded.args[0].map(item => {
                const owner = '0x' + item.callData.slice(-40);
                const raw = owner.toLowerCase() === wallet ? amounts[item.target.toLowerCase()] ?? '0' : '99';
                return { success: true, returnData: '0x' + BigInt(raw).toString(16).padStart(64, '0') };
              });
              return viem.encodeFunctionResult({ abi: viem.multicall3Abi, functionName: 'aggregate3', result: values });
            }, { data: callData, amounts: tokenValues(chainId), wallet: metadata.wallet });
          } else if (callData.startsWith('0x70a08231')) {
            const owner = ('0x' + callData.slice(-40)).toLowerCase();
            result = pad(owner === metadata.wallet ? tokenValues(chainId)[call.params[0].to.toLowerCase()] ?? '0' : '4500000');
          } else result = pad(0);
          break;
        }
        default: return { jsonrpc: '2.0', id: call.id, error: { code: -32601, message: 'Unmocked RPC: ' + call.method } };
      }
      return { jsonrpc: '2.0', id: call.id, result };
    };
    await route.fulfill({ json: Array.isArray(payload) ? await Promise.all(payload.map(answer)) : await answer(payload) });
  });
  const unlock = async () => {
    await page.evaluate(async () => { window.__interAssetTestViem = await import('/node_modules/.vite/deps/viem.js'); });
    for (const digit of ['1', '2', '3', '4', '5', '6']) await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByRole('button', { name: 'View assets', exact: true }).waitFor();
  };
  const checkSecondary = async (name, eth, usdc) => {
    const section = page.getByRole('region', { name: name + ' balances', exact: true });
    await section.getByTestId('secondary-eth-balance').getByText(eth, { exact: true }).waitFor();
    await section.getByTestId('secondary-usdc-balance').getByText(usdc, { exact: true }).waitFor();
  };
  await page.reload();
  await unlock();
  await checkSecondary('Base', '0.12345678', '200.12');
  await page.getByText('0.12345678', { exact: true }).first().waitFor();
  const logo = page.getByRole('img', { name: 'cirBTC logo', exact: true }).first();
  await page.waitForFunction(() => [...document.images].some(image => image.alt === 'cirBTC logo' && image.complete && image.naturalWidth > 0));
  if (!(await logo.getAttribute('src')).includes('cirbtc')) throw Error('Official bundled cirBTC logo was not used');
  await page.screenshot({ path: 'output/playwright/secondary-mainnet-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Bridge USDC', exact: true }).click();
  await page.getByText('Balance: 200.123456 USDC', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'View assets', exact: true }).click();
  await checkSecondary('Base', '0.12345678', '200.12');
  await page.getByRole('button', { name: /Circle Wrapped Bitcoin/ }).click();
  await page.getByText('Decimals', { exact: true }).waitFor();
  const contract = await page.getByRole('link', { name: '0x171a...baa0', exact: true }).getAttribute('href');
  if (!contract.includes('explorer.arc.io/address/0x171a4217b86a807a64eb94757db6849fb4bdbaa0')) throw Error('Wrong mainnet cirBTC contract link');
  await page.getByText('+0.00000001', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  delayBase = true;
  await page.getByRole('button', { name: 'Refresh Base balances', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Switch to Arc Testnet', exact: true }).click();
  await checkSecondary('Base Sepolia', '0.87654321', '9.75');
  await page.getByText('0.00000001', { exact: true }).waitFor();
  await page.waitForTimeout(1000);
  await checkSecondary('Base Sepolia', '0.87654321', '9.75');
  if (await page.getByRole('region', { name: 'Base balances', exact: true }).count()) throw Error('Mainnet secondary section leaked into testnet');
  delayBase = false;
  await page.screenshot({ path: 'output/playwright/secondary-testnet-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'View assets', exact: true }).click();
  await page.getByRole('button', { name: /Circle Wrapped Bitcoin/ }).click();
  const testContract = await page.getByRole('link', { name: '0xf0C4...32BF', exact: true }).getAttribute('href');
  if (!testContract.includes('explorer.testnet.arc.io/address/0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF')) throw Error('Wrong testnet cirBTC contract link');
  await page.getByText('Testnet cirBTC', { exact: true }).waitFor();
  await page.getByText('+0.00000001', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  let sheet = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Send USDC', exact: true }) });
  await sheet.getByRole('button', { name: /USDC/ }).first().click();
  await sheet.getByRole('button', { name: /Circle Wrapped Bitcoin/ }).click();
  sheet = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Send cirBTC', exact: true }) });
  await sheet.getByPlaceholder('0x... or yourname.arc').fill('0x2222222222222222222222222222222222222222');
  await sheet.getByPlaceholder('0.00').fill('0.00000001');
  await sheet.getByRole('button', { name: 'Review Transaction', exact: true }).click();
  await sheet.getByText('0.00000001 cirBTC', { exact: true }).waitFor();
  await sheet.locator('button').first().click();
  failSecondary = true;
  await page.getByRole('button', { name: 'Refresh Base Sepolia balances', exact: true }).click();
  const section = page.getByRole('region', { name: 'Base Sepolia balances', exact: true });
  await section.getByText('Balance unavailable', { exact: true }).first().waitFor();
  if (await section.getByText('Balance unavailable', { exact: true }).count() !== 2) throw Error('Failed reads were not distinguished from zero');
  failSecondary = false;
  mismatchSecondary = true;
  await page.getByRole('button', { name: 'Refresh Base Sepolia balances', exact: true }).click();
  await section.getByText('Balance unavailable', { exact: true }).first().waitFor();
  mismatchSecondary = false;
  await page.getByRole('button', { name: 'Refresh Base Sepolia balances', exact: true }).click();
  await checkSecondary('Base Sepolia', '0.87654321', '9.75');
  await page.reload();
  await unlock();
  await checkSecondary('Base Sepolia', '0.87654321', '9.75');
  for (const chainId of [8453, 84532]) {
    const reads = requests.filter(request => request.chainId === chainId && request.method === 'eth_call');
    if (!reads.some(request => request.params[0].to.toLowerCase() === secondaryUsdc[chainId])) throw Error('Wrong secondary USDC contract on chain ' + chainId);
  }
  if (requests.some(request => request.method === 'eth_sendRawTransaction')) throw Error('A transaction was unexpectedly broadcast');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'output/playwright/secondary-testnet-desktop.png', fullPage: true });
  return 'PASS: mainnet/testnet secondary ETH and USDC, shared bridge balance, delayed-network isolation, cirBTC logo/contracts/satoshi history and review, error recovery, RPC-chain validation, reload, and responsive layout. All RPCs mocked; no broadcasts.';
}
