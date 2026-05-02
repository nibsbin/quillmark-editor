# `@quillmark/editor`

Lexical-based rich-text editor for [QuillMark](https://github.com/anthropics/quillmark) documents. Ships as a single npm package with three entry points:

- **`@quillmark/editor`** &mdash; Svelte 5 components (`<VisualEditor>`, `<QuillmarkPreview>`, `useEditor`)
- **`@quillmark/editor/element`** &mdash; self-contained `<quillmark-editor>` and `<quillmark-preview>` custom elements
- **`@quillmark/editor/core`** &mdash; headless TypeScript (no DOM, no framework). For server / agent code.

This package replaces the ProseMirror-based editor in [`tonguetoquill-web`](https://github.com/tonguetoquill/tonguetoquill-web) with a smaller, more declarative Lexical core. See `references/PROGRAM.md` for the full design rationale.

## Installation

```sh
npm install @quillmark/editor @quillmark/wasm
```

`@quillmark/wasm` is a peer dependency, **minimum version 0.68.0** &mdash; the preview pipeline relies on `Quill.open(doc).paint(ctx, page, { layoutScale, densityScale }) → PaintResult` from that release, where the painter owns `canvas.width`/`canvas.height` and the consumer owns `canvas.style.*`. `@quillmark/editor` does **not** bundle, fetch, or own the WASM lifecycle &mdash; the host injects it via the `QuillmarkHost` interface (a small superset of `tonguetoquill-web`'s `quillmarkService`).

## Architecture in one sentence

`createEditorState({ quillmark })` is the canonical primitive: a reactive handle around `@quillmark/wasm`'s `Document`. Both `<VisualEditor>` and `<QuillmarkPreview>` subscribe to the same handle &mdash; no markdown round-trip between them, no double-parse. Markdown stays as the persistence format at the edges (save/load, custom-element `markdown` attribute), not the inter-component contract.

## Svelte usage

```svelte
<script lang="ts">
  import { VisualEditor, QuillmarkPreview, createEditorState } from '@quillmark/editor';
  import '@quillmark/editor/styles.css';
  import { quillmarkService } from '$lib/services/quillmark';

  const state = createEditorState({ quillmark: quillmarkService });
  await state.load(initialMarkdown);
</script>

<div class="editor-grid">
  <VisualEditor {state} theme="auto" features={{ tables: true, cards: true }} />
  <QuillmarkPreview {state} />
</div>
```

The preview is Canvas-based: the package paints each page directly into a `<canvas>` via `quill.open(doc).paint(...)`. There is no `render` injection prop &mdash; hosts wanting a different strategy should compose their own UI atop `EditorState`.

Optional `paint={...}` prop tunes scale, page subset, and gap:

```svelte
<QuillmarkPreview
  {state}
  paint={{ scale: 2, gapPx: 24, pages: [0, 1] }}
/>
```

The package ships **no layout primitive**. The host wires whatever split-pane / tabs / modal layout it needs.

## Custom-element usage

```html
<script type="module" src="/dist/element/index.js"></script>
<link rel="stylesheet" href="/dist/styles.css" />

<quillmark-editor></quillmark-editor>
<quillmark-preview></quillmark-preview>

<script type="module">
  import { quillmarkService } from './my-quillmark-host.js';
  import { createEditorState } from '/dist/element/index.js';

  await quillmarkService.initialize();
  const state = createEditorState({ quillmark: quillmarkService });
  await state.load(initialMarkdown);

  const editorEl = document.querySelector('quillmark-editor');
  const previewEl = document.querySelector('quillmark-preview');
  editorEl.state = state;
  previewEl.state = state;
  // No `render` prop — preview paints via `quill.open(doc).paint(...)`.

  editorEl.addEventListener('quillmark-change', (e) => save(e.detail.markdown));
</script>
```

`<quillmark-editor>` also accepts a `markdown` attribute as a fallback when `state` is not assigned &mdash; useful for editor-only HTML hosts that don't need the preview side.

## Headless / server usage

```ts
import { createEditorState } from '@quillmark/editor/core';
import { quillmarkService } from './my-quillmark-host';

const state = createEditorState({ quillmark: quillmarkService });
await state.load(markdown);
state.setMainBody('Hello, world.');
state.addCard(0, 'note_card', { priority: 5 });
const updated = state.toMarkdown();
```

Plain pub-sub reactivity:

```ts
const off = state.subscribe((version) => {
  console.log('document changed', version);
});
```

The `core` entry has **no** Svelte runtime dependency. It runs in Node, in CI, and in agent contexts.

## QuillmarkHost contract

The host injects an object satisfying:

```ts
interface QuillmarkHost {
  isReady(): boolean;
  readonly Document: typeof import('@quillmark/wasm').Document;
  getQuill(ref: string): Quill;
  ensureQuillResolved(ref: string): Promise<void>;
}
```

`tonguetoquill-web`'s `quillmarkService` already satisfies this shape. Other hosts can wrap `@quillmark/wasm` directly.

## V1 scope &amp; known gaps

V1 covers the architectural backbone end-to-end:

- ✅ Three working entry points with conditional `exports`.
- ✅ Canonical `EditorState` primitive (load → mutate → serialize).
- ✅ Lexical body editor with markdown round-trip; QuillMark `__text__`-as-underline transformer.
- ✅ Schema-driven metadata form (text / number / boolean / enum / date / array-of-string).
- ✅ Card list with add / move / delete / reorder.
- ✅ `<VisualEditor>` and `<QuillmarkPreview>` Svelte 5 components.
- ✅ Canvas-based preview via `@quillmark/wasm` ≥ 0.68's `Quill.open(doc).paint(...)` with split `layoutScale` / `densityScale` knobs — no `render` injection.
- ✅ `<quillmark-editor>` and `<quillmark-preview>` custom elements with `state` property + `markdown` attribute fallback.
- ✅ Schema walker / validator / date-path collector callable headlessly.
- ✅ Core unit tests (no Svelte runtime).

Deliberately deferred (see `references/PROGRAM.md`):

- ❌ Full table parity (Obsidian-style edge controls, row drag) &mdash; `@lexical/table` defaults wired up; insert / delete row / col, merge / unmerge work via Lexical's built-in commands but we don't ship the hover affordances yet (PROGRAM.md O4).
- ❌ Full `list-commands.ts` 700-line edge-case audit (PROGRAM.md O5) &mdash; Lexical defaults only.
- ❌ React adapter (PROGRAM.md §6.1, deferred indefinitely; React hosts use the custom element).
- ❌ Real-time collaboration / CRDTs (PROGRAM.md §2 non-goal).
- ❌ MS Teams / MCP Apps embedded mode (PROGRAM.md §4.3, V1 is standalone-only).
- ❌ Editor mode switch (markdown source view) and resizable split panel &mdash; both are host chrome (PROGRAM.md §2 non-goals).

## Canvas preview trade-offs

Preview is Canvas-only. The package paints directly via `quill.open(doc).paint(ctx, page, { layoutScale, densityScale }) → PaintResult` &mdash; faster and cheaper than the prior SVG path on multi-page documents, but with two intentional consequences hosts should know about:

- **No text selection in the preview.** Canvas is a bitmap. If users need select-to-copy on the rendered page, they should look at the source markdown side instead.
- **No screen-reader coverage of preview content.** Assistive tech sees nothing inside the canvas. The editor side is fully accessible; the preview is decorative.

Browser zoom (Ctrl-+/-) and pinch-zoom are handled automatically: `<QuillmarkPreview>` subscribes to `matchMedia('(resolution)')` and `visualViewport.resize` and triggers a debounced repaint when DPR or pinch scale changes. Hosts can still override `paint.densityScale` for in-app zoom controls; `layoutScale` independently controls the CSS display-box size so layout and rasterization density don't have to move together. Non-Svelte hosts driving `paintPagesIntoElement` directly can call the same `watchZoom(callback)` helper from `@quillmark/editor/core`.

If these are blockers for your application, do not use `<QuillmarkPreview>` &mdash; compose your own preview UI atop `EditorState` directly.

## Markdown round-trip caveat

QuillMark uses `__text__` for underline (Word convention), not bold &mdash; the spike's `UNDERLINE_UNDERSCORE` transformer is wired in by default. Documents that previously stored bold via underscores will be re-serialized as bold via asterisks; this is a visible source-text diff but not a semantic one. See PROGRAM.md §7.

## WASM prerequisite

Per PROGRAM.md §7: a 3rd-party SaaS or vanilla HTML page wanting to drop in `<quillmark-editor>` must `npm install @quillmark/wasm`, write a host service satisfying `QuillmarkHost`, and wire it before the element works. That's three setup steps, not one. The alternative &mdash; bundling WASM &mdash; violates the §2 non-goal "Quill / WASM fetching strategy". A future `@quillmark/editor/standalone` sub-export with a bundled WASM bootstrap could close the gap; not in V1.

## Versioning

Independent SemVer. Pin `@quillmark/wasm` minimum version in your host package; bump deliberately. (PROGRAM.md O8.)

## Development

```sh
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # builds core, svelte, and element bundles into dist/
npm run size        # gzip + raw-size guard on dist/element/index.js
```

## License

MIT
