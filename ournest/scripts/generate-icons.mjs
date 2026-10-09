// Renders the brand mark to PNG app icons with headless Chromium.
// Usage: node scripts/generate-icons.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const mark = (bg, inset) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <g transform="translate(${inset} ${inset}) scale(${(512 - inset * 2) / 64})">
    <path d="M17 33.5 32 21l15 12.5" fill="none" stroke="#f7f4ec" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21 36.5c2.5 6.2 6.4 9.3 11 9.3s8.5-3.1 11-9.3" fill="none" stroke="#f7f4ec" stroke-width="4.2" stroke-linecap="round" opacity=".92"/>
    <circle cx="32" cy="34.5" r="3.1" fill="#f7f4ec"/>
  </g>
</svg>`;

const BG = "#0d6a4d";
const targets = [
  { file: "icon-192.png", size: 192, svg: mark(BG, -24) },
  { file: "icon-512.png", size: 512, svg: mark(BG, -24) },
  { file: "icon-maskable-512.png", size: 512, svg: mark(BG, 56) },
  { file: "apple-touch-icon.png", size: 180, svg: mark(BG, -24) },
  { file: "favicon-32.png", size: 32, svg: mark(BG, -6) },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0">${t.svg.replace("<svg ", `<svg width="${t.size}" height="${t.size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${t.file}`, omitBackground: false });
  console.log("✓", t.file);
}
await browser.close();
