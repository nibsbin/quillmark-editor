<script lang="ts">
  /**
   * QuillmarkPreview — Canvas-based preview of an `EditorState`.
   *
   * Subscribes to the shared state, debounces version bumps, and paints each
   * page of `state.document` into a `<canvas>` via `@quillmark/wasm` ≥ 0.68's
   * `Quill.open(doc).paint(ctx, page, { layoutScale, densityScale })` primitive.
   *
   * Trade-offs (intentional for V1, see PROGRAM.md follow-up):
   *   - No text selection in the preview (Canvas is a bitmap).
   *   - No screen-reader coverage of preview content.
   *   - Browser-zoom (Ctrl-+) is now a host concern: feed the new
   *     `visualViewport.scale` into `paint.densityScale` to repaint crisply.
   *
   * No SVG fallback. Hosts wanting a different strategy should compose their
   * own UI atop `EditorState` instead of using this component.
   */

  import { onDestroy, untrack } from 'svelte';
  import type { EditorState, PaintOptions, TelemetryHandler } from '../core/index.js';
  import { paintPagesIntoElement, watchZoom } from '../core/index.js';
  import { useEditor } from './use-editor.svelte.js';

  interface Props {
    state: EditorState;
    debounceMs?: number;
    placeholder?: string;
    /** Optional paint customization (layoutScale, densityScale, page subset, gap, canvas class). */
    paint?: PaintOptions;
    onError?: (err: unknown) => void;
    onTelemetry?: TelemetryHandler;
  }

  let {
    state: editorState,
    debounceMs = 250,
    placeholder = '',
    paint: paintOpts,
    onError,
    onTelemetry,
  }: Props = $props();

  // `editorState` is a stable handle for the component lifetime — the public
  // contract treats it as constant, so referencing it directly here is safe.
  // svelte-ignore state_referenced_locally
  const editor = useEditor(editorState);

  let host: HTMLDivElement | null = $state(null);
  let pending = $state(false);
  let errored = $state<string | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;

  $effect(() => {
    void editor.version;
    const ready = editor.isInitialized;
    untrack(() => {
      if (!ready) return;
      schedule();
    });
  });

  // Auto-repaint on browser zoom (Ctrl-+/-) and pinch-zoom. Without this the
  // canvas backing store stays at the DPR captured at the previous paint and
  // looks blurry until the next document edit forces a repaint. The host
  // doesn't have to wire anything; passing `paint.densityScale` explicitly
  // overrides the default but still triggers a repaint via this listener.
  $effect(() => {
    const stop = watchZoom(() => schedule());
    return stop;
  });

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runRender, debounceMs);
  }

  function runRender() {
    if (!host) return;
    const doc = editorState.document;
    if (!doc) return;
    const ref = editor.quillRef;
    if (!ref) {
      errored = 'Document has no QUILL frontmatter directive.';
      return;
    }

    inflight?.abort();
    const ac = new AbortController();
    inflight = ac;
    pending = true;
    errored = null;
    const t0 = performance.now();

    try {
      const quill = editorState.quillmark.getQuill(ref);
      const painted = paintPagesIntoElement(quill, doc, host, ac.signal, paintOpts);
      if (ac.signal.aborted || painted < 0) return;
      onTelemetry?.({
        name: 'preview.render',
        detail: {
          ms: Math.round(performance.now() - t0),
          quillRef: ref,
          pages: painted,
        },
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      errored = err instanceof Error ? err.message : String(err);
      onError?.(err);
      onTelemetry?.({ name: 'preview.error', detail: { message: errored } });
    } finally {
      if (inflight === ac) inflight = null;
      pending = false;
    }
  }

  onDestroy(() => {
    if (timer) clearTimeout(timer);
    inflight?.abort();
  });
</script>

<div class="qme-preview-root">
  {#if errored}
    <div class="qme-preview-error" role="alert">{errored}</div>
  {/if}
  {#if pending}
    <div class="qme-preview-status" aria-live="polite">Rendering…</div>
  {/if}
  {#if !editor.isInitialized && placeholder}
    <div class="qme-preview-placeholder">{placeholder}</div>
  {/if}
  <div bind:this={host} class="qme-preview-host" aria-hidden="true"></div>
</div>

<!-- Cosmetic styles live in dist/styles.css so hosts have one override surface. -->

