<!-- svelte-ignore options_missing_custom_element -->
<svelte:options customElement={{
  tag: 'quillmark-preview',
  shadow: 'none',
  props: {
    state: { reflect: false, type: 'Object' },
    debounceMs: { reflect: true, type: 'Number' },
    placeholder: { reflect: true, type: 'String' },
    paint: { reflect: false, type: 'Object' }
  }
}} />

<script lang="ts">
  /**
   * <quillmark-preview> custom element. Wraps QuillmarkPreview; expects
   * `state` to be set as a JS property (object references can't round-trip
   * through HTML attributes).
   *
   * Canvas-only — no `render` injection. The preview paints directly via
   * `@quillmark/wasm` ≥ 0.68's `Quill.open(doc).paint(ctx, page, { layoutScale, densityScale })` path.
   */

  import QuillmarkPreview from '../svelte/QuillmarkPreview.svelte';
  import type { EditorState, PaintOptions } from '../core/index.js';

  interface Props {
    state?: EditorState;
    debounceMs?: number;
    placeholder?: string;
    paint?: PaintOptions;
  }

  let {
    state: editorState,
    debounceMs = 250,
    placeholder = '',
    paint,
  }: Props = $props();
</script>

{#if editorState}
  <QuillmarkPreview state={editorState} {debounceMs} {placeholder} {paint} />
{:else}
  <div class="qme-element-pending">Waiting for `state` injection…</div>
{/if}

<style>
  .qme-element-pending {
    padding: 1rem;
    color: var(--qme-muted, #64748b);
    font-style: italic;
    text-align: center;
  }
</style>
