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

<!-- Cosmetic styles live in dist/styles.css so hosts have one override surface. -->

