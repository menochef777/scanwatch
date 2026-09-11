async function checkAll() {
  const res = await fetch('https://scanwatch8.vercel.app?v=' + Date.now(), { headers: { 'cache-control': 'no-cache' } });
  const html = await res.text();
  console.log('HTML size:', html.length);
  const regex = /["'](\/_next\/static\/chunks\/[^"']+\.js)["']/g;
  let match;
  const chunkUrls = [];
  while ((match = regex.exec(html)) !== null) {
    chunkUrls.push(match[1]);
  }
  console.log('Found chunk URLs:', chunkUrls);

  for (const url of chunkUrls) {
    const r = await fetch('https://scanwatch8.vercel.app' + url);
    const text = await r.text();
    if (text.includes('What do you want to watch')) {
      console.log('>>> FOUND NEW TEXT in:', url);
    }
    if (text.includes('Extracted Page Content')) {
      console.log('>>> FOUND OLD TEXT in:', url);
    }
    if (text.includes('Your Monitors')) {
      console.log('>>> FOUND Your Monitors in:', url);
    }
  }
}
checkAll();
