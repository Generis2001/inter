/* oxlint-disable eslint/no-unused-expressions -- Playwright CLI expects a function expression. */
async page => {
  const metadata = await page.evaluate(async () => {
    const viem = await import('/node_modules/.vite/deps/viem.js'); window.__bridgeTestViem = viem;
    const { getBridgeChain } = await import('/src/utils/bridgeChains.ts');
    const isTestnet = localStorage.getItem('inter_network_testnet') === 'true';
    const source = getBridgeChain(isTestnet ? 5042002 : 5042);
    const destination = getBridgeChain(isTestnet ? 84532 : 8453);
    return { wallet: JSON.parse(localStorage.getItem('inter_wallet_vault_v1')).address,
      source: { id: source.chain.id, domain: source.domain, usdc: source.usdc, messenger: source.messenger },
      destination: { id: destination.chain.id, domain: destination.domain, messenger: destination.messenger, name: destination.chain.name },
      isTestnet,
      selectors: Object.fromEntries(['localDomain()', 'remoteTokenMessengers(uint32)', 'usedNonces(bytes32)', 'depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)', 'receiveMessage(bytes,bytes)'].map(s => [s.split('(')[0], viem.toFunctionSelector(s)])) };
  });
  const pad = value => '0x' + BigInt(value).toString(16).padStart(64,'0');
  const addressWord = address => address.slice(2).padStart(64,'0');
  const blockHash = pad(123);
  const sent = []; let sourceConfirmed = false; let attested = false;
  const lostResponses = new Set(['approval', 'burn', 'mint']);
  const block = { baseFeePerGas: '0x3b9aca00', difficulty:'0x0', extraData:'0x', gasLimit:'0x1c9c380', gasUsed:'0x0', hash:blockHash,
    logsBloom:'0x'+'00'.repeat(256), miner:'0x'+'11'.repeat(20), mixHash:pad(0), nonce:'0x0000000000000000', number:'0x10',
    parentHash:pad(122), receiptsRoot:pad(0), sha3Uncles:pad(0), size:'0x1', stateRoot:pad(0), timestamp:'0x65ffffff',
    totalDifficulty:'0x0', transactions:[], transactionsRoot:pad(0), uncles:[] };
  await page.route('**/api/tower/rpc/*', async route => {
    const chain = Number(route.request().url().split('/').pop());
    const payload = route.request().postDataJSON();
    const answer = async call => {
      const params = call.params ?? []; let result;
      switch (call.method) {
        case 'eth_chainId': result = '0x'+chain.toString(16); break;
        case 'eth_blockNumber': result = '0x10'; break;
        case 'eth_getBalance': result = '0x56bc75e2d63100000'; break;
        case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': result = '0x3b9aca00'; break;
        case 'eth_getBlockByNumber': result = block; break;
        case 'eth_getTransactionCount': result = '0x'+sent.filter(tx => tx.chainId === chain).length.toString(16); break;
        case 'eth_estimateGas': result = '0x186a0'; break;
        case 'eth_getCode': result = '0x6000'; break;
        case 'eth_getLogs': result = []; break;
        case 'eth_call': {
          const selector = params[0].data.slice(0,10);
          if(selector === '0x70a08231') result = pad(100000000);
          else if(selector === '0xdd62ed3e') result = pad(sent.some(tx => tx.kind === 'approval') ? 1000000 : 0);
          else if(selector === metadata.selectors.localDomain) result = pad(chain === metadata.source.id ? metadata.source.domain : metadata.destination.domain);
          else if(selector === metadata.selectors.remoteTokenMessengers) result = '0x'+addressWord(chain === metadata.source.id ? metadata.destination.messenger : metadata.source.messenger);
          else if(selector === metadata.selectors.usedNonces) result = pad(0);
          else if(selector === metadata.selectors.depositForBurn) result = '0x';
          else result = pad(1);
          break;
        }
        case 'eth_sendRawTransaction': {
          const tx = await page.evaluate(raw => {
            const viem = window.__bridgeTestViem;
            const tx = viem.parseTransaction(raw);
            return { hash:viem.keccak256(raw), to:tx.to, data:tx.data, chainId:tx.chainId };
          }, params[0]);
          tx.kind = tx.data.startsWith(metadata.selectors.depositForBurn) ? 'burn' : tx.data.startsWith(metadata.selectors.receiveMessage) ? 'mint' : 'approval';
          tx.raw = params[0]; sent.push(tx);
          const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inter_bridges_v1_'+JSON.parse(localStorage.getItem('inter_wallet_vault_v1')).address.toLowerCase()))[0]);
          const hashField = tx.kind==='burn' ? 'sourceHash' : tx.kind==='mint' ? 'destinationHash' : 'approvalHash';
          if(saved[hashField] !== tx.hash) throw Error('Transaction was broadcast before its hash was saved');
          if(lostResponses.delete(tx.kind)) return {httpError:true};
          result = tx.hash; break;
        }
        case 'eth_getTransactionReceipt': {
          const tx = sent.find(item => item.hash === params[0]);
          result = !tx || (tx.kind === 'burn' && !sourceConfirmed) ? null : {
            blockHash, blockNumber:'0x10', contractAddress:null, cumulativeGasUsed:'0x186a0', effectiveGasPrice:'0x3b9aca00',
            from:metadata.wallet, gasUsed:'0x186a0', logs:[], logsBloom:'0x'+'00'.repeat(256), status:'0x1',
            to:tx.to, transactionHash:tx.hash, transactionIndex:'0x0', type:'0x2' };
          break;
        }
        default: return {jsonrpc:'2.0',id:call.id,error:{code:-32601,message:'Unmocked method '+call.method}};
      }
      return {jsonrpc:'2.0',id:call.id,result};
    };
    const response = Array.isArray(payload) ? await Promise.all(payload.map(answer)) : await answer(payload);
    if(!Array.isArray(response) && response.httpError) await route.fulfill({status:502,json:{error:'Response lost after accepting the transaction'}});
    else await route.fulfill({json:response});
  });
  await page.route('https://iris-api*.circle.com/**', async route => {
    if(route.request().url().includes('/fees/')) { await route.fulfill({json:[{finalityThreshold:2000,minimumFee:0}]}); return; }
    if(!attested) { await route.fulfill({json:{messages:[]}}); return; }
    const message = '0x'+[
      '00000001',metadata.source.domain.toString(16).padStart(8,'0'),metadata.destination.domain.toString(16).padStart(8,'0'),pad(99).slice(2),addressWord(metadata.source.messenger),addressWord(metadata.destination.messenger),pad(0).slice(2),'000007d0','000007d0',
      '00000001',addressWord(metadata.source.usdc),addressWord(metadata.wallet),pad(1000000).slice(2),addressWord(metadata.wallet),
      pad(0).slice(2),pad(0).slice(2),pad(0).slice(2)
    ].join('');
    await route.fulfill({json:{messages:[{status:'complete',message,attestation:'0x123456'}]}});
  });
  await page.evaluate(() => { localStorage.setItem('inter_require_tx_pin','true'); window.dispatchEvent(new CustomEvent('inter_security_settings_changed',{detail:{requireTxPin:true}})); });
  if(await page.getByRole('heading',{name:'Welcome Back'}).count()) for(const digit of ['1','2','3','4','5','6']) await page.getByRole('button',{name:digit,exact:true}).click();
  if(await page.getByRole('heading',{name:'Bridge USDC'}).count()===0) await page.getByRole('button',{name:'Bridge',exact:true}).click();
  await page.getByRole('button',{name:'Out of Arc',exact:true}).click();
  await page.getByRole('textbox',{name:'USDC bridge amount'}).fill('1');
  const reviewButton = page.getByRole('button',{name:'Review bridge',exact:true});
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button=>button.textContent==='Review bridge' && !button.disabled), null, {timeout:15000});
  await page.getByRole('textbox',{name:'USDC bridge amount'}).fill('2');
  if(await reviewButton.isEnabled()) throw Error('An amount change left a stale quote actionable');
  await page.getByRole('button',{name:metadata.isTestnet ? 'Switch to Arc Mainnet' : 'Switch to Arc Testnet',exact:true}).click();
  if(await reviewButton.isEnabled()) throw Error('A network change left a stale quote actionable');
  await page.getByRole('button',{name:metadata.isTestnet ? 'Switch to Arc Testnet' : 'Switch to Arc Mainnet',exact:true}).click();
  await page.getByRole('textbox',{name:'USDC bridge amount'}).fill('1');
  await reviewButton.click({timeout:15000});
  await page.getByRole('button',{name:'Authorize with PIN',exact:true}).click();
  for(const digit of ['1','2','3','4','5','6']) await page.getByRole('button',{name:digit,exact:true}).click();
  await page.getByRole('button',{name:'Continue bridge',exact:true}).waitFor({timeout:20000});
  const approved = await page.evaluate(() => JSON.parse(localStorage.getItem('inter_bridges_v1_'+JSON.parse(localStorage.getItem('inter_wallet_vault_v1')).address.toLowerCase()))[0]);
  if(approved.status!=='ready-to-submit' || !approved.approvalHash || approved.sourceHash) throw Error('An interrupted approval was mistaken for a USDC burn');
  if(sent.length!==1 || sent[0].kind!=='approval') throw Error('Approval was rebroadcast automatically');
  await page.getByRole('link',{name:'Approval transaction',exact:true}).waitFor();
  await page.getByRole('button',{name:'Continue bridge',exact:true}).click();
  await page.getByRole('button',{name:'Authorize with PIN',exact:true}).click();
  for(const digit of ['1','2','3','4','5','6']) await page.getByRole('button',{name:digit,exact:true}).click();
  await page.getByRole('button',{name:'Retry the same transaction',exact:true}).waitFor({timeout:20000});
  const savedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('inter_bridges_v1_'+JSON.parse(localStorage.getItem('inter_wallet_vault_v1')).address.toLowerCase()))[0]);
  if(savedBefore.status !== 'source-pending' || !savedBefore.sourceSignedTransaction) throw Error('Lost burn response was not recoverable');
  if(!savedBefore.error.includes('HTTP 502') || !savedBefore.error.includes('signed bridge is saved')) throw Error('HTTP interruption did not explain the saved transaction');
  if(sent.filter(tx => tx.kind==='burn').length!==1) throw Error('Broadcast was retried automatically');
  await page.getByRole('link',{name:'Approval transaction',exact:true}).waitFor();
  await page.getByRole('link',{name:'Source transaction',exact:true}).waitFor();
  await page.reload();
  for(const digit of ['1','2','3','4','5','6']) await page.getByRole('button',{name:digit,exact:true}).click();
  await page.getByRole('button',{name:'Bridge',exact:true}).click();
  // Imported modules are reset by reload; restore the test hash/parser helper.
  await page.evaluate(async () => { window.__bridgeTestViem = await import('/node_modules/.vite/deps/viem.js'); });
  await page.getByRole('button',{name:'Retry the same transaction',exact:true}).click();
  await page.waitForTimeout(500);
  const burns = sent.filter(tx => tx.kind==='burn');
  if(burns.length !== 2 || burns[0].raw !== burns[1].raw) throw Error('Reload recovery sent a different burn transaction');
  sourceConfirmed = true;
  await page.getByRole('button',{name:'Refresh bridge',exact:true}).click();
  await page.getByText('Waiting for settlement',{exact:true}).waitFor();
  attested = true;
  await page.getByRole('button',{name:'Refresh bridge',exact:true}).click();
  await page.getByRole('button',{name:'Receive USDC on '+metadata.destination.name,exact:true}).click();
  await page.getByText('Receiving gas estimate',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Authorize with PIN',exact:true}).click();
  for(const digit of ['1','2','3','4','5','6']) await page.getByRole('button',{name:digit,exact:true}).click();
  await page.waitForFunction(id => JSON.parse(localStorage.getItem('inter_bridges_v1_'+JSON.parse(localStorage.getItem('inter_wallet_vault_v1')).address.toLowerCase())).some(row=>row.id===id && row.status==='complete'), savedBefore.id, {timeout:20000});
  const completed = await page.evaluate(id => JSON.parse(localStorage.getItem('inter_bridges_v1_'+JSON.parse(localStorage.getItem('inter_wallet_vault_v1')).address.toLowerCase())).find(row=>row.id===id), savedBefore.id);
  if(completed.status!=='complete' || !completed.destinationHash || completed.sourceSignedTransaction || completed.destinationSignedTransaction) throw Error('Destination receipt did not settle saved operation');
  if(sent.filter(tx=>tx.kind==='mint').length!==1 || sent.filter(tx=>tx.kind==='approval').length!==1) throw Error('Incorrect signing sequence');
  await page.screenshot({path:'output/playwright/bridge-complete-'+(metadata.isTestnet ? 'testnet' : 'mainnet')+'-mocked.png'});
  console.log('PASS ('+(metadata.isTestnet ? 'testnet' : 'mainnet')+'): PIN, exact approval, persist-before-broadcast, HTTP 502 recovery after approval/burn/mint, no automatic rebroadcast, reload/retry with identical bytes, attestation wait, receiving fee review, destination receipt, no second burn. All broadcasts mocked.');
}
