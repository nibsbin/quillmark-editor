/**
 * Zoom-reactivity helper for canvas preview consumers.
 *
 * Browser zoom (Ctrl-+, Ctrl--) changes `window.devicePixelRatio` but does
 * not fire any DOM event by itself; the canonical detection trick is a
 * `matchMedia('(resolution: <current>dppx)')` listener that fires when the
 * threshold is crossed, then re-arming with the new DPR. Pinch-zoom on
 * mobile is reported via `visualViewport.scale` and surfaced as a
 * `visualViewport.resize` event.
 *
 * `watchZoom(cb)` subscribes to both signals and invokes `cb` when either
 * changes. Returns an unsubscribe function. Safe to call in non-DOM
 * environments — returns a no-op unsubscribe.
 *
 * Used by `<QuillmarkPreview>` to auto-repaint on zoom; non-Svelte hosts
 * driving `paintPagesIntoElement` directly can call this themselves.
 */

export function watchZoom(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  // matchMedia '(resolution: ...)' fires once when DPR crosses the boundary,
  // so we re-arm with the new DPR each time it fires.
  let mq: MediaQueryList | null = null;
  let mqHandler: ((this: MediaQueryList, e: MediaQueryListEvent) => void) | null = null;

  function armDpr(): void {
    detachDpr();
    const dpr = window.devicePixelRatio || 1;
    mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    mqHandler = () => {
      armDpr();
      onChange();
    };
    mq.addEventListener('change', mqHandler);
  }

  function detachDpr(): void {
    if (mq && mqHandler) {
      mq.removeEventListener('change', mqHandler);
    }
    mq = null;
    mqHandler = null;
  }

  armDpr();

  // Pinch-zoom: track `visualViewport.scale` deltas. Other resize causes
  // (keyboard popup, window resize) also fire `resize`; gate on a real
  // scale change so we don't repaint for every keystroke on mobile.
  const vv = window.visualViewport ?? null;
  let lastScale = vv?.scale ?? 1;
  const vvHandler = (): void => {
    if (!vv) return;
    if (vv.scale !== lastScale) {
      lastScale = vv.scale;
      onChange();
    }
  };
  vv?.addEventListener('resize', vvHandler);

  return () => {
    detachDpr();
    vv?.removeEventListener('resize', vvHandler);
  };
}
