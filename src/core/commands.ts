/**
 * Headless commands callable from any host.
 *
 * V1 surface is intentionally thin (per PROGRAM.md §5.5 — reach-in APIs are
 * how the ProseMirror version became a 1,500-line custom-commands codebase).
 * Commands here are stateless functions over `EditorState`; the UI layer
 * adds keymap / toolbar bindings on top.
 */

import type { EditorState } from './editor-state.js';

/** Insert a card after the currently active position (or at end). */
export function insertCardAfter(
  state: EditorState,
  insertAt: number,
  tag: string,
  defaults: Record<string, unknown> = {},
): number {
  return state.addCard(insertAt, tag, defaults);
}

/** Move a card up/down by one slot. Clamps to bounds. */
export function moveCardBy(state: EditorState, index: number, delta: -1 | 1): boolean {
  return state.moveCard(index, index + delta);
}

/**
 * Read the per-tag default frontmatter from a Quill's `blankCard(tag)` call.
 * Mirrors VisualEditor's `getBlankCardDefaults`.
 */
export function getBlankCardDefaults(
  state: EditorState,
  tag: string,
): Record<string, unknown> {
  const ref = state.quillRef;
  if (!ref) return {};
  try {
    const quill = state.quillmark.getQuill(ref);
    const blank = quill.blankCard(tag) as {
      values?: Record<string, { source: string; default: unknown }>;
    } | null;
    if (!blank?.values) return {};
    const out: Record<string, unknown> = {};
    for (const [name, entry] of Object.entries(blank.values)) {
      if (entry.source === 'default') out[name] = entry.default;
    }
    return out;
  } catch {
    return {};
  }
}
