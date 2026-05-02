<script lang="ts">
  /**
   * BodyEditor — mounts a Lexical editor on a contenteditable div and emits
   * markdown back to the host on change.
   *
   * Owns:
   *   - Lexical editor lifecycle (createEditor + setRootElement).
   *   - Initial markdown load via `loadMarkdown` (`@lexical/markdown`).
   *   - `onChange` debounce + serialize-on-mutation.
   *
   * Does NOT own:
   *   - The document model. Mutations are emitted via `onChange`; the parent
   *     wires them to `state.setMainBody` / `state.setCardBody`.
   *   - Toolbar UI. The toolbar is composed at the VisualEditor level and
   *     dispatches Lexical commands against the active editor.
   */

  import { onMount, onDestroy } from 'svelte';
  import { createEditor, type LexicalEditor } from 'lexical';
  import { registerRichText } from '@lexical/rich-text';
  import { registerHistory, createEmptyHistoryState } from '@lexical/history';
  import { registerMarkdownShortcuts } from '@lexical/markdown';
  import { mergeRegister } from '@lexical/utils';
  import {
    buildEditorConfig,
    buildTransformers,
    loadMarkdown,
    serializeMarkdown,
  } from '../core/index.js';

  interface Props {
    content: string;
    placeholder?: string;
    editable?: boolean;
    debounceMs?: number;
    onChange?: (markdown: string) => void;
    onParseFallback?: (err: unknown) => void;
    onFocusChange?: (focused: boolean) => void;
  }

  let {
    content,
    placeholder = '',
    editable = true,
    debounceMs = 200,
    onChange,
    onParseFallback,
    onFocusChange,
  }: Props = $props();

  let host: HTMLDivElement | null = $state(null);
  let editor: LexicalEditor | null = null;
  let cleanup: (() => void) | null = null;
  let lastEmitted = '';
  let suppressEmit = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const TRANSFORMERS = buildTransformers();

  onMount(() => {
    if (!host) return;
    editor = createEditor(buildEditorConfig({ editable }));
    editor.setRootElement(host);

    // Initial content load. Suppress the change emit so we don't echo back
    // the host-supplied markdown.
    suppressEmit = true;
    loadMarkdown(editor, content ?? '', onParseFallback);
    lastEmitted = content ?? '';
    suppressEmit = false;

    cleanup = mergeRegister(
      registerRichText(editor),
      registerHistory(editor, createEmptyHistoryState(), 1000),
      registerMarkdownShortcuts(editor, TRANSFORMERS),
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        if (suppressEmit) return;
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        scheduleEmit();
      }),
    );

    // Fire focus events (purely for UX hooks like toolbar visibility).
    const focusIn = () => onFocusChange?.(true);
    const focusOut = () => onFocusChange?.(false);
    host.addEventListener('focusin', focusIn);
    host.addEventListener('focusout', focusOut);
    const unsubscribeFocus = () => {
      host?.removeEventListener('focusin', focusIn);
      host?.removeEventListener('focusout', focusOut);
    };

    const baseCleanup = cleanup;
    cleanup = () => {
      unsubscribeFocus();
      baseCleanup?.();
    };
  });

  $effect(() => {
    // External content swap (e.g., parent loaded a different doc). Avoid
    // round-trips by short-circuiting when it matches our last emit.
    const next = content ?? '';
    if (!editor) return;
    if (next === lastEmitted) return;
    suppressEmit = true;
    loadMarkdown(editor, next, onParseFallback);
    lastEmitted = next;
    suppressEmit = false;
  });

  $effect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  });

  function scheduleEmit() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(emit, debounceMs);
  }

  function emit() {
    if (!editor) return;
    const md = serializeMarkdown(editor);
    if (md === lastEmitted) return;
    lastEmitted = md;
    onChange?.(md);
  }

  export function focus() {
    editor?.focus();
  }

  export function getEditor(): LexicalEditor | null {
    return editor;
  }

  /** Run a callback inside an editor.update() — used by the toolbar. */
  export function update(fn: () => void) {
    editor?.update(fn);
  }

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    cleanup?.();
    cleanup = null;
    editor = null;
  });
</script>

<div
  bind:this={host}
  class="qme-body-editor"
  contenteditable={editable}
  data-placeholder={placeholder}
  spellcheck="true"
  role="textbox"
  aria-multiline="true"
  aria-label={placeholder || 'Editor body'}
></div>

<!-- Cosmetic styles live in dist/styles.css so hosts have one override surface. -->

