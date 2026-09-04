// Compose a branded homepage hero image (1200x750) with sharp — dark Cyber-Luxe style
const sharp = require('sharp');
const { createCanvas } = require('canvas') || null;

const W = 1200, H = 750;

async function main() {
  const { createSVG } = await import('./_hero-svg.mjs');
  const svg = createSVG(W, H);
  await sharp(Buffer.from(svg)).png().toFile('public/dashboard-hero.png');
  console.log('hero saved');
}
main().catch(e => { console.error(e.message); process.exit(1); });
