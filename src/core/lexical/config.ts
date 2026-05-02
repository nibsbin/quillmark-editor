/**
 * Lexical editor configuration shared by every BodyEditor instance.
 *
 * Nodes registered: paragraph, heading, lists, link, code, quote, table.
 * Markdown round-trip uses `@lexical/markdown` with the underline transformer
 * substitution from `./transformers.ts`.
 */

import type { CreateEditorArgs, Klass, LexicalNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { defaultTheme } from './theme.js';

export const EDITOR_NODES: ReadonlyArray<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableCellNode,
  TableRowNode,
];

export interface BuildEditorConfigOpts {
  namespace?: string;
  theme?: CreateEditorArgs['theme'];
  editable?: boolean;
  onError?: (error: Error) => void;
}

export function buildEditorConfig(opts: BuildEditorConfigOpts = {}): CreateEditorArgs {
  return {
    namespace: opts.namespace ?? 'quillmark-editor',
    theme: opts.theme ?? defaultTheme,
    editable: opts.editable ?? true,
    nodes: [...EDITOR_NODES],
    onError: opts.onError ?? defaultOnError,
  };
}

function defaultOnError(error: Error): void {
  // Surfaced via the BodyEditor `onParseFallback` hook in the UI layer; here
  // we just log so headless consumers don't lose the trace silently.
  console.error('[Lexical]', error);
}
