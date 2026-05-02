#!/usr/bin/env node
/**
 * Bundle-size guard for `dist/element/index.js`.
 *
 * PROGRAM.md §7 calls out: "A future contributor adding @lexical/yjs or a
 * large highlighter package will silently erode the bundle win. Add a CI
 * check on dist/element.js size with a fail threshold."
 *
 * The threshold is intentionally generous for V1 (the spike measured ~76KB
 * gzipped for the editor-core packages alone; the WC bundle adds the Svelte
 * runtime + our component code, so the realistic budget is higher). Tune
 * once we have a real first measurement.
 */

import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const TARGET = resolve(process.cwd(), 'dist/element/index.js');
// First measurement: 472.96 KB raw / 125.29 KB gz (Lexical + Svelte + UI).
// Budget = first-measurement + ~10% slack so future contributors notice
// when a new dependency adds meaningful weight.
const RAW_BUDGET_BYTES = 525 * 1024; // 525 KB minified
const GZIP_BUDGET_BYTES = 140 * 1024; // 140 KB gzipped

let stat;
try {
  stat = statSync(TARGET);
} catch (err) {
  console.error(`[size] Cannot stat ${TARGET}. Run \`npm run build:element\` first.`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}

const raw = stat.size;
const gz = gzipSync(readFileSync(TARGET)).length;

const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;

console.log(`[size] dist/element/index.js: ${fmt(raw)} raw, ${fmt(gz)} gzipped`);

let failed = false;
if (raw > RAW_BUDGET_BYTES) {
  console.error(`[size] FAIL: raw size ${fmt(raw)} > budget ${fmt(RAW_BUDGET_BYTES)}`);
  failed = true;
}
if (gz > GZIP_BUDGET_BYTES) {
  console.error(`[size] FAIL: gzip size ${fmt(gz)} > budget ${fmt(GZIP_BUDGET_BYTES)}`);
  failed = true;
}
if (failed) process.exit(1);
