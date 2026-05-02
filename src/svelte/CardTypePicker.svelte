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

<!-- Cosmetic styles live in dist/styles.css so hosts have one override surface. -->

