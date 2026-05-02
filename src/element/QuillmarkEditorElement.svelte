<!-- svelte-ignore options_missing_custom_element -->
<svelte:options customElement={{
  tag: 'quillmark-editor',
  shadow: 'none',
  props: {
    markdown: { reflect: true, type: 'String' },
    theme: { reflect: true, type: 'String' },
    features: { reflect: false, type: 'Object' },
    classification: { reflect: false, type: 'Object' },
    quillmark: { reflect: false, type: 'Object' },
    state: { reflect: false, type: 'Object' }
  }
}} />

<script lang="ts">
  /**
   * <quillmark-editor> custom element.
   *
   * Accepts either:
   *   - `state` (JS property; preferred for co-located preview siblings)
   *   - or `quillmark` + `markdown` (attribute fallback; the WC owns the
   *     EditorState and dispatches `quillmark-change` with `{ markdown }`)
   *
   * Light-DOM (per O2 recommendation): host CSS can target the element; the
   * package namespaces all classes under `qme-` to limit the conflict surface.
   */

  import { onDestroy, untrack } from 'svelte';
  import VisualEditor from '../svelte/VisualEditor.svelte';
  import {
    createEditorState,
    type EditorState,
    type FeatureFlags,
    type QuillmarkHost,
  } from '../core/index.js';

  interface ClassificationConfig {
    banner?: string;
    bannerPosition?: 'top' | 'bottom';
  }

  interface Props {
    state?: EditorState;
    quillmark?: QuillmarkHost;
    markdown?: string;
    theme?: 'light' | 'dark' | 'auto';
    features?: FeatureFlags;
    classification?: ClassificationConfig;
  }

  let {
    state: externalState,
    quillmark,
    markdown = '',
    theme = 'auto',
    features,
    classification,
  }: Props = $props();

  // Internal state used when no external `state` is provided. We create at
  // most one — switching from the markdown-attr path to the property path
  // mid-flight is undefined behavior per the §5.2 contract.
  let internalState: EditorState | null = null;

  const effectiveState = $derived.by<EditorState | null>(() => {
    if (externalState) return externalState;
    if (!quillmark) return null;
    if (!internalState) {
      internalState = createEditorState({ quillmark });
    }
    return internalState;
  });

  let host: HTMLElement | null = $state(null);

  function dispatchChange(md: string) {
    host?.dispatchEvent(
      new CustomEvent('quillmark-change', {
        bubbles: true,
        composed: true,
        detail: { markdown: md },
      }),
    );
  }

  // Markdown-attribute → state load. Only fires when we're owning the state.
  $effect(() => {
    const next = markdown ?? '';
    const s = effectiveState;
    untrack(async () => {
      if (!s) return;
      // Only consume the attribute when we're driving an internal state.
      // External states are owned by the parent script and load themselves.
      if (s !== internalState) return;
      if (!next) return;
      if (s.equalsMarkdown(next)) return;
      try {
        await s.load(next);
      } catch (err) {
        host?.dispatchEvent(
          new CustomEvent('quillmark-error', {
            bubbles: true,
            composed: true,
            detail: { error: err instanceof Error ? err.message : String(err) },
          }),
        );
      }
    });
  });

  // Subscribe to mutations; emit `quillmark-change` for hosts on the string-
  // only path. External-state consumers wire their own subscribe() calls.
  let unsubscribe: (() => void) | null = null;
  $effect(() => {
    unsubscribe?.();
    unsubscribe = null;
    const s = effectiveState;
    if (!s) return;
    if (s !== internalState) return;
    unsubscribe = s.subscribe(() => {
      dispatchChange(s.toMarkdown());
    });
  });

  onDestroy(() => {
    unsubscribe?.();
    internalState?.destroy();
  });
</script>

<div bind:this={host} class="qme-element-host">
  {#if effectiveState}
    <VisualEditor
      state={effectiveState}
      {theme}
      features={features ?? {}}
      {classification}
    />
  {:else}
    <div class="qme-element-pending">Waiting for `state` or `quillmark` injection…</div>
  {/if}
</div>

<style>
  .qme-element-host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 200px;
  }
  .qme-element-pending {
    padding: 1rem;
    color: var(--qme-muted, #64748b);
    font-style: italic;
    text-align: center;
  }
</style>
