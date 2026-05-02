<script lang="ts">
  /**
   * Toolbar — a thin wrapper that dispatches Lexical formatting commands
   * against the currently focused BodyEditor. V1 covers bold / italic /
   * underline / strikethrough / code / undo / redo / link / list / heading
   * level. Tables get a single "insert table" button; full edge-control
   * parity is deferred (see PROGRAM.md O4).
   */

  import {
    FORMAT_TEXT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
    type LexicalEditor,
    $getSelection as getSelection_,
    $isRangeSelection as isRangeSelection_,
    $createParagraphNode as createParagraphNode_,
  } from 'lexical';
  import { $setBlocksType as setBlocksType_ } from '@lexical/selection';
  import {
    $createHeadingNode as createHeadingNode_,
    $createQuoteNode as createQuoteNode_,
  } from '@lexical/rich-text';
  import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    REMOVE_LIST_COMMAND,
  } from '@lexical/list';
  import { TOGGLE_LINK_COMMAND } from '@lexical/link';
  import { INSERT_TABLE_COMMAND } from '@lexical/table';

  interface Props {
    getEditor: () => LexicalEditor | null;
    features?: { tables?: boolean; links?: boolean; code?: boolean };
  }

  let { getEditor, features = {} }: Props = $props();
  const showTables = $derived(features.tables !== false);
  const showLinks = $derived(features.links !== false);
  const showCode = $derived(features.code !== false);

  function withEditor(fn: (e: LexicalEditor) => void) {
    const e = getEditor();
    if (e) fn(e);
  }

  function format(type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') {
    withEditor((e) => e.dispatchCommand(FORMAT_TEXT_COMMAND, type));
  }

  function setBlock(level: 1 | 2 | 3 | 'p' | 'q') {
    withEditor((e) => {
      e.update(() => {
        const sel = getSelection_();
        if (!isRangeSelection_(sel)) return;
        if (level === 'p') setBlocksType_(sel, () => createParagraphNode_());
        else if (level === 'q') setBlocksType_(sel, () => createQuoteNode_());
        else setBlocksType_(sel, () => createHeadingNode_(`h${level}`));
      });
    });
  }

  function toggleList(kind: 'ul' | 'ol' | 'none') {
    withEditor((e) => {
      if (kind === 'none') e.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      else if (kind === 'ul') e.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      else e.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    });
  }

  function insertLink() {
    const url = window.prompt('Link URL');
    if (!url) return;
    withEditor((e) => e.dispatchCommand(TOGGLE_LINK_COMMAND, url));
  }

  function insertTable() {
    withEditor((e) => e.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' }));
  }

  function undo() {
    withEditor((e) => e.dispatchCommand(UNDO_COMMAND, undefined));
  }
  function redo() {
    withEditor((e) => e.dispatchCommand(REDO_COMMAND, undefined));
  }
</script>

<div class="qme-toolbar" role="toolbar" aria-label="Editor toolbar">
  <button type="button" class="qme-tb-btn" aria-label="Undo" onclick={undo}>↶</button>
  <button type="button" class="qme-tb-btn" aria-label="Redo" onclick={redo}>↷</button>
  <span class="qme-tb-sep"></span>
  <select
    class="qme-tb-select"
    aria-label="Block style"
    onchange={(e) => {
      const v = (e.target as HTMLSelectElement).value;
      if (v === 'p') setBlock('p');
      else if (v === 'q') setBlock('q');
      else setBlock(Number(v) as 1 | 2 | 3);
    }}
  >
    <option value="p">Body</option>
    <option value="1">Heading 1</option>
    <option value="2">Heading 2</option>
    <option value="3">Heading 3</option>
    <option value="q">Quote</option>
  </select>
  <span class="qme-tb-sep"></span>
  <button type="button" class="qme-tb-btn" aria-label="Bold" onclick={() => format('bold')}><b>B</b></button>
  <button type="button" class="qme-tb-btn" aria-label="Italic" onclick={() => format('italic')}><i>I</i></button>
  <button type="button" class="qme-tb-btn" aria-label="Underline" onclick={() => format('underline')}><u>U</u></button>
  <button type="button" class="qme-tb-btn" aria-label="Strikethrough" onclick={() => format('strikethrough')}><s>S</s></button>
  {#if showCode}
    <button type="button" class="qme-tb-btn" aria-label="Inline code" onclick={() => format('code')}><code>{'<>'}</code></button>
  {/if}
  <span class="qme-tb-sep"></span>
  <button type="button" class="qme-tb-btn" aria-label="Bulleted list" onclick={() => toggleList('ul')}>•</button>
  <button type="button" class="qme-tb-btn" aria-label="Numbered list" onclick={() => toggleList('ol')}>1.</button>
  <button type="button" class="qme-tb-btn" aria-label="Remove list" onclick={() => toggleList('none')}>—</button>
  {#if showLinks}
    <span class="qme-tb-sep"></span>
    <button type="button" class="qme-tb-btn" aria-label="Insert link" onclick={insertLink}>🔗</button>
  {/if}
  {#if showTables}
    <span class="qme-tb-sep"></span>
    <button type="button" class="qme-tb-btn" aria-label="Insert table" onclick={insertTable}>⊞</button>
  {/if}
</div>

<style>
  .qme-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    background: var(--qme-toolbar-bg, #f8fafc);
    border-bottom: 1px solid var(--qme-border, #e2e8f0);
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .qme-tb-btn {
    appearance: none;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    color: inherit;
    font: inherit;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .qme-tb-btn:hover {
    background: var(--qme-toolbar-hover, #e2e8f0);
  }
  .qme-tb-btn:focus-visible {
    outline: 2px solid var(--qme-focus, #3b82f6);
    outline-offset: 1px;
  }
  .qme-tb-sep {
    width: 1px;
    height: 1.25rem;
    background: var(--qme-border, #cbd5e1);
    margin: 0 0.25rem;
  }
  .qme-tb-select {
    height: 2rem;
    padding: 0 0.5rem;
    border: 1px solid var(--qme-border, #cbd5e1);
    border-radius: 4px;
    background: var(--qme-input-bg, #fff);
  }
</style>
