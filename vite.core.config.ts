import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/core/**/*.ts'],
      outDir: 'dist/core',
      entryRoot: 'src/core',
      tsconfigPath: 'tsconfig.json',
      compilerOptions: {
        declarationMap: true,
        noEmit: false,
        emitDeclarationOnly: true,
      },
    }),
  ],
  build: {
    outDir: 'dist/core',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: resolve(__dirname, 'src/core/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        '@quillmark/wasm',
        /^lexical(\/|$)/,
        /^@lexical\//,
      ],
    },
  },
});
