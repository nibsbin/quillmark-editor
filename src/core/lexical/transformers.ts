/**
 * Markdown transformers for `@lexical/markdown`.
 *
 * QuillMark uses `__text__` for underline (Word convention), not bold. The
 * spike-validated approach replaces the default `BOLD_UNDERSCORE` transformer
 * with `UNDERLINE_UNDERSCORE` so round-trip preserves underline. Documents
 * that previously used double-underscore for bold are re-serialized as bold
 * via asterisks (functionally equivalent — see PROGRAM.md §7).
 */

import type { TextFormatTransformer } from '@lexical/markdown';
import { TRANSFORMERS } from '@lexical/markdown';

/** Replacement transformer for the default `BOLD_UNDERSCORE`. */
export const UNDERLINE_UNDERSCORE: TextFormatTransformer = {
  format: ['underline'],
  tag: '__',
  type: 'text-format',
};

/**
 * Strip the default `BOLD_UNDERSCORE` (tag `__`, format `bold`) and substitute
 * `UNDERLINE_UNDERSCORE`. Other transformers (italic `*`, italic `_`, bold
 * `**`, code `` ` ``, strikethrough `~~`) flow through unchanged.
 */
export function buildTransformers() {
  return TRANSFORMERS.map((t) => {
    if (
      t.type === 'text-format' &&
      (t as TextFormatTransformer).tag === '__' &&
      ((t as TextFormatTransformer).format ?? []).includes('bold')
    ) {
      return UNDERLINE_UNDERSCORE;
    }
    return t;
  });
}
