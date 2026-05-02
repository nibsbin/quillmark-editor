<script lang="ts">
  /**
   * CardTypePicker — UI-only chooser for the tag of a fresh card. Surfaces
   * before we commit the card to the wasm Document, so users can cancel
   * without leaving stale state behind.
   */

  interface Props {
    items: readonly string[];
    onSelect: (tag: string) => void;
    onCancel?: () => void;
    autoFocus?: boolean;
  }

  let { items, onSelect, onCancel, autoFocus = true }: Props = $props();
  let select: HTMLSelectElement | null = $state(null);

  $effect(() => {
    if (autoFocus) select?.focus();
  });

  function handleChange(ev: Event) {
    const v = (ev.target as HTMLSelectElement).value;
    if (v) onSelect(v);
  }

  function formatLabel(tag: string): string {
    const clean = tag.replace(/_card$/, '');
    return clean
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
</script>

<div class="qme-picker">
  <span class="qme-picker-label">Choose card type</span>
  <div class="qme-picker-row">
    <select bind:this={select} class="qme-input qme-picker-select" onchange={handleChange}>
      <option value="">—</option>
      {#each items as tag}
        <option value={tag}>{formatLabel(tag)}</option>
      {/each}
    </select>
    {#if onCancel}
      <button type="button" class="qme-icon-btn" aria-label="Cancel" onclick={onCancel}>×</button>
    {/if}
  </div>
</div>

<style>
  .qme-picker {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.625rem 0.75rem;
    border: 1px dashed var(--qme-active, #3b82f6);
    border-radius: 6px;
    background: var(--qme-picker-bg, rgba(59, 130, 246, 0.05));
  }
  .qme-picker-label {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--qme-muted, #64748b);
  }
  .qme-picker-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .qme-picker-select {
    flex: 1;
    border: 1px solid var(--qme-border, #cbd5e1);
    border-radius: 4px;
    padding: 0.375rem 0.5rem;
    background: var(--qme-input-bg, #fff);
    font: inherit;
  }
  .qme-icon-btn {
    appearance: none;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    line-height: 1;
    color: inherit;
  }
  .qme-icon-btn:hover {
    background: var(--qme-toolbar-hover, #e2e8f0);
  }
</style>
