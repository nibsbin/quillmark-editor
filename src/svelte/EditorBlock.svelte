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

<!-- Cosmetic styles live in dist/styles.css so hosts have one override surface. -->

