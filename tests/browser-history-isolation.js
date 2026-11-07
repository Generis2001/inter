/* oxlint-disable eslint/no-unused-expressions -- Playwright CLI expects a function expression. */
async page => {
  if(await page.getByRole('heading',{name:'Welcome Back'}).count()) {
    for(const digit of ['1','2','3','4','5','6']) await page.getByRole('button',{name:digit,exact:true}).click();
    await page.getByRole('button',{name:'Bridge',exact:true}).waitFor();
  }
  await page.route('**/api/v2/addresses/**', async route => {
    if (route.request().url().includes('explorer.arc.io')) await new Promise(resolve => setTimeout(resolve, 600));
    await route.fulfill({json:{items:[]}});
  });
  await page.route('**/*', async route => {
    if (route.request().method()==='POST' && !route.request().url().includes('/api/tower/')) {
      try {const body=route.request().postDataJSON(); if(body?.method==='eth_getLogs' || body?.method==='eth_blockNumber') {
        await route.fulfill({json:{jsonrpc:'2.0',id:body.id,result:body.method==='eth_getLogs'?[]:'0x1'}});return;
      }} catch {}
    }
    await route.fallback();
  });
  await page.evaluate(() => {
    const wallet=JSON.parse(localStorage.getItem('inter_wallet_vault_v1')).address;
    const other='0x2222222222222222222222222222222222222222';
    const make=(id,value,symbol,direction,chainId)=>({hash:'0x'+id.toString(16).padStart(64,'0'),from:direction==='received'?other:wallet,to:direction==='received'?wallet:other,value,rawValue:BigInt(Math.round(Number(value)*1e6)).toString(),tokenSymbol:symbol,timestamp:Date.now()-id,status:'success',direction,blockNumber:'42',gasUsed:'20000',txType:'transfer',...(chainId?{chainId}:{})});
    const mainnet=[make(901,'41.250000','USDC','sent'),make(902,'12.500000','EURC','received')];
    localStorage.setItem('inter_wallet_txs_'+wallet.toLowerCase(),JSON.stringify(mainnet));
    localStorage.setItem('inter_tx_history_'+wallet.toLowerCase(),JSON.stringify(mainnet));
    localStorage.setItem('inter_wallet_txs_testnet_'+wallet.toLowerCase(),JSON.stringify(mainnet));
    localStorage.setItem('inter_wallet_txs_v2_5042002_'+wallet.toLowerCase(),JSON.stringify([make(903,'2.750000','EURC','sent',5042002)]));
    window.dispatchEvent(new CustomEvent('inter_tx_recorded',{detail:{chainId:5042}}));
  });
  await page.getByRole('button',{name:'Activity',exact:true}).click();
  await page.getByText('-41.250000 USDC',{exact:true}).waitFor();
  await page.getByText('+12.500000 EURC',{exact:true}).waitFor();
  const logo=await page.getByRole('img',{name:'USDC logo',exact:true}).first().getAttribute('width');
  if(logo!=='34') throw Error('Transfer currency logo was not prominent');
  await page.screenshot({path:'output/playwright/activity-mainnet.png'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('inter_tx_recorded',{detail:{chainId:5042}})));
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:'Switch to Arc Testnet',exact:true}).click();
  await page.getByRole('button',{name:'Activity',exact:true}).click();
  await page.getByText('-2.750000 EURC',{exact:true}).waitFor();
  await page.waitForTimeout(900);
  if(await page.getByText('-41.250000 USDC',{exact:true}).count()) throw Error('Mainnet record leaked after switching to testnet');
  if(await page.getByText('+12.500000 EURC',{exact:true}).count()) throw Error('Legacy mainnet record leaked to testnet');
  await page.screenshot({path:'output/playwright/activity-testnet.png'});
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:'Bridge',exact:true}).click();
  await page.getByText('Base Sepolia',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Out of Arc',exact:true}).click();
  await page.screenshot({path:'output/playwright/bridge-testnet.png'});
  console.log('PASS: currency logos, Sent/Received labels, legacy isolation, late-poll isolation, and testnet bridge navigation');
}
