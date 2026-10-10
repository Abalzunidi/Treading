// يجمع الواجهة (HTML + CSS + JS) في ملف واحد dist/GoldTradingJournal.html للفتح من سطح المكتب.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p)}\n</script>`);

// الصور والأيقونات تُدمج كـ data URI لتعمل الصفحة كملف واحد
const mime = { ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
html = html.replace(/<link rel="manifest"[^>]*>\n?/g, "");
html = html.replace(/(href|src)="(img\/[^"]+)"/g, (_, attr, p) => {
  const buf = fs.readFileSync(path.join(root, p));
  return `${attr}="data:${mime[path.extname(p)]};base64,${buf.toString("base64")}"`;
});

const out = path.join(root, '..', 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'GoldTradingJournal.html'), html);
console.log('dist/GoldTradingJournal.html', Math.round(html.length / 1024) + ' KB');
