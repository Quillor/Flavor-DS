// Emits dist/i18n.json from apps/docs/src/product/i18n.ts (single source for web + Figma).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../../apps/docs/src/product/i18n.ts'), 'utf8');
const langs = ['en','es','zh','de','ar'];
const out = {};
const re = /^\s*([a-zA-Z]+):\s*\{\s*en:\s*'((?:[^'\\]|\\.)*)',\s*es:\s*'((?:[^'\\]|\\.)*)',\s*zh:\s*'((?:[^'\\]|\\.)*)',\s*de:\s*'((?:[^'\\]|\\.)*)',\s*ar:\s*'((?:[^'\\]|\\.)*)'\s*\}/gm;
let m; while ((m = re.exec(src))) { out[m[1]] = { en: m[2], es: m[3], zh: m[4], de: m[5], ar: m[6] }; }
// template extras used in Figma sign-in
Object.assign(out, {
  tagline: { en: 'Tastefully engineered.', es: 'Diseñado con gusto.', zh: '匠心打造。', de: 'Mit Geschmack entwickelt.', ar: 'هندسة بذوق رفيع.' },
  taglineSub: { en: 'One design system for every product surface.', es: 'Un sistema de diseño para cada superficie de producto.', zh: '一套设计系统，覆盖所有产品界面。', de: 'Ein Designsystem für jede Produktoberfläche.', ar: 'نظام تصميم واحد لكل واجهات المنتج.' },
  noAccount: { en: 'New here?', es: '¿Eres nuevo?', zh: '新用户？', de: 'Neu hier?', ar: 'جديد هنا؟' },
});
writeFileSync(join(__dirname, 'dist/i18n.json'), JSON.stringify({ langs, labels: { en: 'English', es: 'Español', zh: '中文', de: 'Deutsch', ar: 'العربية' }, dir: { en: 'ltr', es: 'ltr', zh: 'ltr', de: 'ltr', ar: 'rtl' }, strings: out }));
console.log('i18n.json:', Object.keys(out).length, 'keys');
