<script lang="ts">
  /**
   * AddCardTrigger — single-tap "+ add card" affordance between cards.
   * Card-type picking happens in `<CardTypePicker>` once activated; this
   * component just signals intent and the position.
   */

  interface Props {
    onAdd: () => void;
    isLast?: boolean;
    disabled?: boolean;
  }

  let { onAdd, isLast = false, disabled = false }: Props = $props();
</script>

<button
  type="button"
  class="qme-add-card"
  class:qme-add-last={isLast}
  aria-label="Add card here"
  {disabled}
  onclick={onAdd}
>
  <span class="qme-add-line"></span>
  <span class="qme-add-pill">+ Add card</span>
  <span class="qme-add-line"></span>
</button>

<style>
  .qme-add-card {
    appearance: none;
    background: transparent;
    border: none;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0;
    cursor: pointer;
    color: var(--qme-muted, #64748b);
    opacity: 0.6;
    transition: opacity 120ms ease;
  }
  .qme-add-card:hover:not([disabled]) {
    opacity: 1;
  }
  .qme-add-card[disabled] {
    cursor: not-allowed;
    opacity: 0.3;
  }
  .qme-add-line {
    flex: 1;
    height: 1px;
    background: var(--qme-border, #e2e8f0);
  }
  .qme-add-pill {
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--qme-block-bg, #fff);
    border: 1px dashed var(--qme-border, #cbd5e1);
    border-radius: 999px;
    padding: 0.125rem 0.625rem;
  }
</style>
