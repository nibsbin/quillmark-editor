<script lang="ts">
  /**
   * EditorBlock — visual frame around a primary or card section. Provides
   * the title bar, drag-handle area (V1: native HTML5 DnD per O3), and the
   * card-controls dropdown. Click selects the block.
   */

  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    variant?: 'primary' | 'card';
    isActive?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    canMove?: boolean;
    canDelete?: boolean;
    hideLabel?: boolean;
    onLabelChange?: (next: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onDelete?: () => void;
    onclick?: (ev: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    label,
    variant = 'primary',
    isActive = false,
    isFirst = false,
    isLast = false,
    canMove = true,
    canDelete = true,
    hideLabel = false,
    onLabelChange,
    onMoveUp,
    onMoveDown,
    onDelete,
    onclick,
    children,
  }: Props = $props();

  let editing = $state(false);
  let draftLabel = $state('');

  function startEdit() {
    if (!onLabelChange) return;
    draftLabel = label;
    editing = true;
  }

  function commitEdit() {
    editing = false;
    if (draftLabel.trim() && draftLabel !== label) onLabelChange?.(draftLabel.trim());
  }

  function cancelEdit() {
    editing = false;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<section
  class="qme-block qme-block-{variant}"
  class:qme-active={isActive}
  role="group"
  aria-label={label}
  onclick={onclick}
>
  {#if !hideLabel}
    <header class="qme-block-header">
      {#if editing}
        <input
          class="qme-label-input"
          bind:value={draftLabel}
          onblur={commitEdit}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEdit();
            } else if (e.key === 'Escape') {
              cancelEdit();
            }
          }}
        />
      {:else}
        <button
          type="button"
          class="qme-label"
          onclick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
        >
          {label}
        </button>
      {/if}

      {#if variant === 'card'}
        <div class="qme-block-controls">
          <button
            type="button"
            class="qme-icon-btn"
            aria-label="Move up"
            disabled={!canMove || isFirst}
            onclick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}>↑</button>
          <button
            type="button"
            class="qme-icon-btn"
            aria-label="Move down"
            disabled={!canMove || isLast}
            onclick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}>↓</button>
          <button
            type="button"
            class="qme-icon-btn qme-danger"
            aria-label="Delete"
            disabled={!canDelete}
            onclick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}>×</button>
        </div>
      {/if}
    </header>
  {/if}

  <div class="qme-block-body">
    {@render children?.()}
  </div>
</section>

<style>
  .qme-block {
    border: 1px solid var(--qme-border, #e2e8f0);
    border-radius: 8px;
    background: var(--qme-block-bg, #fff);
    overflow: hidden;
    transition: border-color 120ms ease;
  }
  .qme-block.qme-active {
    border-color: var(--qme-active, #3b82f6);
    box-shadow: 0 0 0 1px var(--qme-active, #3b82f6) inset;
  }
  .qme-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--qme-block-header-bg, #f8fafc);
    border-bottom: 1px solid var(--qme-border, #e2e8f0);
  }
  .qme-label {
    appearance: none;
    background: transparent;
    border: none;
    padding: 0.125rem 0.25rem;
    font: inherit;
    font-weight: 600;
    color: inherit;
    cursor: text;
    border-radius: 4px;
  }
  .qme-label:hover {
    background: var(--qme-toolbar-hover, #e2e8f0);
  }
  .qme-label-input {
    border: 1px solid var(--qme-border, #cbd5e1);
    border-radius: 4px;
    padding: 0.125rem 0.25rem;
    font: inherit;
    font-weight: 600;
  }
  .qme-block-controls {
    display: flex;
    gap: 0.25rem;
  }
  .qme-icon-btn {
    appearance: none;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    width: 1.75rem;
    height: 1.75rem;
    cursor: pointer;
    line-height: 1;
    color: inherit;
    font: inherit;
  }
  .qme-icon-btn:hover:not([disabled]) {
    background: var(--qme-toolbar-hover, #e2e8f0);
  }
  .qme-icon-btn[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .qme-icon-btn.qme-danger:hover:not([disabled]) {
    background: var(--qme-danger-bg, #fee2e2);
    color: var(--qme-danger, #b91c1c);
  }
  .qme-block-body {
    display: flex;
    flex-direction: column;
  }
</style>
