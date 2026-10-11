async function run() {
  try {
    const res = await fetch('https://www.tower.exchange/');
    const html = await res.text();
    console.log('HTML length:', html.length);
    const matches = html.match(/<link[^>]+(icon|svg|png)[^>]+>/gi) || [];
    console.log('Link tags:', matches);
    const urls = html.match(/\/static\/[^\s"']+/gi) || html.match(/\/[^\s"']+\.(svg|png)/gi) || [];
    console.log('Urls:', urls.slice(0, 15));
  } catch (err) {
    console.error('Error fetching tower.exchange:', err.message);
  }
}
run();
