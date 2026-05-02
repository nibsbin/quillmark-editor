#!/usr/bin/env node
/**
 * Copy `src/styles/editor.css` to `dist/styles.css` so the package's
 * `./styles.css` export resolves.
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const cwd = process.cwd();
const src = resolve(cwd, 'src/styles/editor.css');
const dest = resolve(cwd, 'dist/styles.css');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[styles] copied ${src} → ${dest}`);
