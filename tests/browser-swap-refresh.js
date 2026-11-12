/* oxlint-disable eslint/no-unused-expressions -- Playwright CLI expects a function expression. */
// Use a new disposable session. Every RPC and transaction broadcast is mocked.
async page => {
  page.setDefaultTimeout(15000);
  const metadata = await page.evaluate(async () => {
    if (localStorage.getItem('inter_wallet_vault_v1')) throw Error('Use an empty disposable session for swap checks.');
    const { accountFromPrivateKey } = await import('/src/utils/wallet.ts');
    const { saveVault } = await import('/src/utils/vault.ts');
    const key = '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
    const account = accountFromPrivateKey(key);
    await saveVault({ address: account.address, privateKey: key }, '123456');
    localStorage.setItem('inter_network_testnet', 'true');
    localStorage.setItem('inter_require_tx_pin', 'false');
    localStorage.setItem('inter_theme', 'dark');
    return { wallet: account.address };
  });
  const word = value => '0x' + BigInt(value).toString(16).padStart(64, '0');
  const usdc = '0x3600000000000000000000000000000000000000';
  const eurc = '0x89b50855aa3be2f677cd6303cec089b5f319d72a';
  const executor = '0xeB8940752Fa12944d3b2D736d51fA36E4dA32BC8';
  let usdcRaw = 50000000n; let eurcRaw = 7500000n; let swappedAt = 0;
  const sent = []; const balanceReads = [];
  const blockHash = word(123);
  const block = { baseFeePerGas: '0x3b9aca00', difficulty: '0x0', extraData: '0x', gasLimit: '0x1c9c380', gasUsed: '0x0', hash: blockHash,
    logsBloom: '0x' + '00'.repeat(256), miner: '0x' + '11'.repeat(20), mixHash: word(0), nonce: '0x0000000000000000', number: '0x10',
    parentHash: word(122), receiptsRoot: word(0), sha3Uncles: word(0), size: '0x1', stateRoot: word(0), timestamp: '0x65ffffff',
    totalDifficulty: '0x0', transactions: [], transactionsRoot: word(0), uncles: [] };
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.includes('/api/v2/addresses/')) return route.fulfill({ json: { items: [] } });
    if (url.hostname === 'arcname.services') return route.fulfill({ json: { status: 'not_found', name: null } });
    if (request.method() !== 'POST') return route.fallback();
    if (url.pathname.endsWith('/swap/quote')) {
      const body = request.postDataJSON();
      if (body.chainId !== 5042002 || body.inputAmount !== '2000000') throw Error('Unexpected swap quote scope');
      return route.fulfill({ json: { success: true, data: { inputToken: usdc, outputToken: eurc, inputAmountRaw: '2000000',
        outputAmount: '1800000000000000000', outputAmountRaw: '1800000', amountScale: 'normalized_1e18', priceImpact: 0.1, dexName: 'Tower' } } });
    }
    if (url.pathname.endsWith('/swap/build-tx')) {
      const body = request.postDataJSON();
      if (body.quote.chainId !== 5042002 || body.chainId !== 5042002) return route.fulfill({ json: { success: false, error: 'No valid route found', code: 'QUOTE_STALE' } });
      return route.fulfill({ json: { success: true, data: { approval: { token: usdc, spender: executor, data: '0x095ea7b3' },
        swap: { to: executor, data: '0xcd6267d5', value: '0', chainId: 5042002 } } } });
    }
    const chainId = url.pathname.includes('/api/tower/rpc/') ? Number(url.pathname.split('/').pop())
      : url.hostname.includes('testnet.arc') ? 5042002 : url.hostname.includes('arc.') ? 5042 : null;
    if (!chainId) return route.abort();
    const payload = request.postDataJSON();
    const balance = (address, data) => {
      if (!data.startsWith('0x70a08231')) return sent.some(tx => tx.kind === 'approval') ? 2000000n : 0n;
      balanceReads.push({ time: Date.now(), chainId, token: address.toLowerCase() });
      if (chainId !== 5042002) return 0n;
      return address.toLowerCase() === usdc ? usdcRaw : address.toLowerCase() === eurc ? eurcRaw : 0n;
    };
    const answer = async call => {
      let result;
      switch (call.method) {
        case 'eth_chainId': result = '0x' + chainId.toString(16); break;
        case 'eth_blockNumber': result = '0x10'; break;
        case 'eth_getBalance': result = '0x2b5e3af16b1880000'; break;
        case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': result = '0x3b9aca00'; break;
        case 'eth_getBlockByNumber': result = block; break;
        case 'eth_getTransactionCount': result = '0x' + sent.length.toString(16); break;
        case 'eth_estimateGas': result = '0x186a0'; break;
        case 'eth_getCode': result = '0x6000'; break;
        case 'eth_getLogs': result = []; break;
        case 'eth_call': {
          const tx = call.params[0];
          if (tx.data.startsWith('0x82ad56cb')) {
            const calls = await page.evaluate(data => window.__swapViem.decodeFunctionData({ abi: window.__swapViem.multicall3Abi, data }).args[0], tx.data);
            const values = calls.map(item => ({ success: true, returnData: word(balance(item.target, item.callData)) }));
            result = await page.evaluate(values => window.__swapViem.encodeFunctionResult({ abi: window.__swapViem.multicall3Abi, functionName: 'aggregate3', result: values }), values);
          } else result = word(balance(tx.to, tx.data));
          break;
        }
        case 'eth_sendRawTransaction': {
          const tx = await page.evaluate(raw => {
            const parsed = window.__swapViem.parseTransaction(raw);
            return { hash: window.__swapViem.keccak256(raw), chainId: parsed.chainId, data: parsed.data, to: parsed.to };
          }, call.params[0]);
          if (tx.chainId !== 5042002) throw Error('A swap was signed on the wrong network');
          tx.kind = tx.data.startsWith('0x095ea7b3') ? 'approval' : 'swap'; sent.push(tx);
          if (tx.kind === 'swap') { usdcRaw -= 2000000n; eurcRaw += 1800000n; swappedAt = Date.now(); }
          result = tx.hash; break;
        }
        case 'eth_getTransactionReceipt': {
          const tx = sent.find(row => row.hash === call.params[0]);
          result = !tx ? null : { blockHash, blockNumber: '0x10', contractAddress: null, cumulativeGasUsed: '0x186a0', effectiveGasPrice: '0x3b9aca00',
            from: metadata.wallet, gasUsed: '0x186a0', logs: [], logsBloom: '0x' + '00'.repeat(256), status: '0x1', to: tx.to,
            transactionHash: tx.hash, transactionIndex: '0x0', type: '0x2' };
          break;
        }
        default: return { jsonrpc: '2.0', id: call.id, error: { code: -32601, message: 'Unmocked RPC: ' + call.method } };
      }
      return { jsonrpc: '2.0', id: call.id, result };
    };
    await route.fulfill({ json: Array.isArray(payload) ? await Promise.all(payload.map(answer)) : await answer(payload) });
  });
  await page.reload();
  await page.evaluate(async () => { window.__swapViem = await import('/node_modules/.vite/deps/viem.js'); });
  for (const digit of ['1', '2', '3', '4', '5', '6']) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Swap', exact: true }).waitFor();
  if (await page.getByText('USDC for gas', { exact: true }).count()) throw Error('The gas badge was not removed');
  await page.screenshot({ path: 'output/playwright/dashboard-currency-watermark.png' });
  await page.getByRole('button', { name: 'Swap', exact: true }).click();
  await page.getByPlaceholder('0.00', { exact: true }).first().fill('2');
  await page.getByRole('button', { name: 'Review Swap', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Swap', exact: true }).click();
  await page.getByRole('heading', { name: 'Swap Complete', exact: true }).waitFor();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByText('9.30', { exact: true }).first().waitFor();
  if (sent.filter(tx => tx.kind === 'swap').length !== 1 || sent.filter(tx => tx.kind === 'approval').length !== 1) throw Error('Unexpected swap signing sequence');
  const postSwap = balanceReads.filter(row => row.time >= swappedAt && row.chainId === 5042002);
  if (!postSwap.some(row => row.token === eurc && row.time - swappedAt < 2000)) throw Error('EURC did not refresh promptly after receipt');
  eurcRaw = 10000000n;
  await page.getByText('10.00', { exact: true }).first().waitFor({ timeout: 7000 });
  if (balanceReads.filter(row => row.time >= swappedAt).length > 60) throw Error('Balance refreshes are looping on renders');
  await page.screenshot({ path: 'output/playwright/swap-testnet-balances-updated.png' });
  return 'PASS: scoped Arc testnet quote/build, one approval and swap, EURC refresh after receipt, five-second polling, and currency-sign watermark. All broadcasts mocked.';
}
