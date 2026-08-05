// Generate homepage hero image from dashboard-preview.html using Windows Chrome
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-gpu', '--single-process', '--window-size=1280,800']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto('file:///mnt/c/Users/nhlaka/Desktop/Youtube%20seo%20tool/dashboard-preview.html', {
    waitUntil: 'networkidle0',
    timeout: 60000
  }).catch(e => console.log('goto warn:', e.message.slice(0, 80)));
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/public/dashboard-hero.png', clip: { x: 0, y: 0, width: 1200, height: 750 } });
  console.log('screenshot saved');
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
