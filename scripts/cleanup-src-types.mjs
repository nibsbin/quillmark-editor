#!/usr/bin/env node
/**
 * Remove `.d.ts` and `.d.ts.map` files that vite-plugin-dts leaks into src/.
 *
 * The plugin is supposed to emit only into `outDir`, but the underlying
 * TypeScript `emit()` call also drops sibling files in src/. Rather than
 * patch the plugin or invent a custom dts pipeline for V1, post-build cleanup
 * is good enough.
 */

import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) walk(path);
    else if (path.endsWith('.d.ts') || path.endsWith('.d.ts.map')) {
      unlinkSync(path);
    }
  }
}

walk(SRC);
console.log('[cleanup] removed leaked .d.ts files from src/');
