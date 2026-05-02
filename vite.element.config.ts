import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

/**
 * Custom-element bundle. Self-contained: bundles the Svelte runtime and
 * Lexical so a `<script type="module">` tag is sufficient. `@quillmark/wasm`
 * is still external — the host injects it via `state.quillmark` per §2.
 */
export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        customElement: true,
      },
    }),
    dts({
      include: ['src/element/**/*.ts'],
      outDir: 'dist/element',
      entryRoot: 'src/element',
      tsconfigPath: 'tsconfig.json',
      compilerOptions: {
        declarationMap: true,
        noEmit: false,
        emitDeclarationOnly: true,
      },
    }),
  ],
  build: {
    outDir: 'dist/element',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: resolve(__dirname, 'src/element/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['@quillmark/wasm'],
    },
  },
});
