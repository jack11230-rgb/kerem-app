import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const dots = [[60, 40], [49, 50], [71, 50], [38, 61], [60, 61], [82, 61], [49, 72], [71, 72], [60, 83]];
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E3C88A"/><stop offset="1" stop-color="#B88F45"/></linearGradient><radialGradient id="bg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#1B2B4D"/><stop offset="1" stop-color="#0B1426"/></radialGradient></defs><rect width="120" height="120" fill="url(#bg)"/><g transform="translate(${pad} ${pad}) scale(${(120 - 2 * pad) / 120})"><circle cx="60" cy="60" r="56" fill="none" stroke="url(#g)" stroke-width="2"/><path d="M60 24c0 0 4-8 14-9" stroke="url(#g)" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M66 20c8-6 18-2 18 6-8 2-14-1-18-6z" fill="url(#g)" opacity=".85"/>${dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.2" fill="url(#g)"/>`).join('')}</g></svg>`;
mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon.svg', svg(14));
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 14], ['icon-512.png', 512, 14], ['maskable-512.png', 512, 26], ['apple-touch-icon.png', 180, 16]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `public/icons/${name}`, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close();
console.log('icons ok');
