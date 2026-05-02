/**
 * `useEditor` — Svelte 5 rune adapter over the framework-neutral `EditorState`.
 *
 * Subscribes to the state's pub-sub bus and exposes `editor.version` etc. as
 * runed reactive properties. Parents only need this when they want their own
 * reactivity (e.g. autosave, dirty tracking). The shipped components subscribe
 * internally.
 *
 * Per PROGRAM.md §6.1: `core` reactivity is plain pub-sub; the Svelte adapter
 * wraps it as runes. Framework-neutrality of `core` is non-negotiable.
 */

import { onDestroy } from 'svelte';
import type { CardView, Diagnostic, EditorState } from '../core/index.js';

export interface SvelteEditorView {
  readonly version: number;
  readonly cards: readonly CardView[];
  readonly mainBody: string;
  readonly mainFrontmatter: Record<string, unknown>;
  readonly quillRef: string;
  readonly isInitialized: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

export function useEditor(state: EditorState): SvelteEditorView {
  let version = $state(state.version);
  const unsubscribe = state.subscribe((v) => {
    version = v;
  });
  onDestroy(unsubscribe);

  return {
    get version() {
      return version;
    },
    get cards() {
      void version;
      return state.cards;
    },
    get mainBody() {
      void version;
      return state.mainBody;
    },
    get mainFrontmatter() {
      void version;
      return state.mainFrontmatter;
    },
    get quillRef() {
      void version;
      return state.quillRef;
    },
    get isInitialized() {
      void version;
      return state.isInitialized;
    },
    get diagnostics() {
      void version;
      return state.diagnostics;
    },
  };
}
