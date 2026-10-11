async function run() {
  const [logo, favicon] = await Promise.all([
    fetch('https://www.tower.exchange/assets/towerlogo.svg').then(r => r.text()),
    fetch('https://www.tower.exchange/favicon.svg').then(r => r.text())
  ]);
  console.log('--- TOWER LOGO SVG ---');
  console.log(logo);
  console.log('--- FAVICON SVG ---');
  console.log(favicon);
}
run();
