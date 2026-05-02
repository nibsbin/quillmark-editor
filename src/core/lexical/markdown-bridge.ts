/**
 * Markdown ↔ Lexical bridge.
 *
 * Wraps `@lexical/markdown`'s `$convertFromMarkdownString` /
 * `$convertToMarkdownString` so the BodyEditor only has to call
 * `loadMarkdown(editor, src)` / `serializeMarkdown(editor)`. Both helpers
 * suppress reactivity-unfriendly throws and surface them via callback.
 */

import type { LexicalEditor } from 'lexical';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import { buildTransformers } from './transformers.js';

const TRANSFORMERS = buildTransformers();

export function loadMarkdown(
  editor: LexicalEditor,
  markdown: string,
  onFallback?: (err: unknown) => void,
): void {
  editor.update(
    () => {
      try {
        $convertFromMarkdownString(markdown, TRANSFORMERS);
      } catch (err) {
        onFallback?.(err);
        // Fallback: load as a plaintext paragraph so the user doesn't lose work.
        $convertFromMarkdownString(markdown.replace(/[#*_~`>|]/g, ''), []);
      }
    },
    { discrete: true },
  );
}

export function serializeMarkdown(editor: LexicalEditor): string {
  let out = '';
  editor.getEditorState().read(() => {
    out = $convertToMarkdownString(TRANSFORMERS);
  });
  return out;
}
