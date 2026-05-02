/**
 * Canvas-based preview rendering, built on `@quillmark/wasm` ≥ 0.68's
 * `Quill.open(doc) → RenderSession.paint(ctx, page, opts) → PaintResult`
 * primitive.
 *
 * This is the *primary* preview path: `<QuillmarkPreview>` calls
 * `paintPagesIntoElement` directly. There is no SVG fallback — hosts wanting
 * a different render strategy should not use `<QuillmarkPreview>` at all and
 * compose their own UI atop `EditorState`.
 *
 * **Sizing model (0.68 contract).** The painter owns
 * `canvas.width` / `canvas.height` and writes them itself. We own
 * `canvas.style.*` and set it from the returned `PaintResult.layoutWidth /
 * Height`. `layoutScale` controls the CSS display-box size (CSS px per
 * Typst pt); `densityScale` controls the backing-store density (DPR × zoom).
 *
 * Trade-offs (see PROGRAM.md follow-up): no text selection, no screen-reader
 * coverage of preview content. With 0.68's `densityScale` knob, browser-zoom
 * blur is now a host concern (re-paint on zoom change with the new value)
 * rather than an architectural limitation.
 */

import type { Document, PaintResult, Quill, RenderSession } from './types.js';

export interface PaintOptions {
  /**
   * Layout-space pixels per Typst point. Default `1` (1 pt → 1 CSS px),
   * which matches the natural Typst page dimensions. Increase to enlarge
   * the preview's display box without changing rasterization density.
   */
  layoutScale?: number;
  /**
   * Backing-store density multiplier. Default
   * `window.devicePixelRatio || 1`. Hosts should fold in-app zoom and
   * `visualViewport.scale` (pinch-zoom) here for crisp output across
   * zoom levels.
   */
  densityScale?: number;
  /** Subset of pages to render. Defaults to all pages. */
  pages?: readonly number[];
  /** Page-to-page gap, in CSS pixels. Default 16. */
  gapPx?: number;
  /** Optional class applied to each `<canvas>` element (for host theming). */
  canvasClass?: string;
}

/**
 * Paint every page of `doc` into freshly-created `<canvas>` elements appended
 * to `host`. `host` is cleared first. Aborts cleanly if `signal` fires.
 *
 * Returns the number of pages painted, or `-1` if aborted before paint, or
 * `0` for documents that compile to zero pages (the host is cleared but no
 * canvas is appended — caller can branch on the return value to surface a
 * "no pages to preview" UI).
 *
 * Throws if the resolved quill's backend does not support canvas preview;
 * surfacing that as a thrown error matches the wasm 0.68 contract.
 */
export function paintPagesIntoElement(
  quill: Quill,
  doc: Document,
  host: HTMLElement,
  signal: AbortSignal,
  opts: PaintOptions = {},
): number {
  if (typeof (quill as { open?: unknown }).open !== 'function') {
    throw new Error(
      '@quillmark/wasm ≥ 0.68.0 is required for canvas preview ' +
        '(Quill.open(doc) is missing on the resolved Quill). ' +
        "Update the host's @quillmark/wasm peer-dep.",
    );
  }
  // 0.68 added `Quill.supportsCanvas` as an eager precondition probe; older
  // bundles miss the property, so we treat absence as "unknown — try anyway,
  // let paint() throw with the resolved backendId."
  const canvasFlag = (quill as Quill & { supportsCanvas?: boolean }).supportsCanvas;
  if (canvasFlag === false) {
    throw new Error(
      `Quill backend "${quill.backendId}" does not support canvas preview ` +
        '(Quill.supportsCanvas === false). Mount a different preview UI for ' +
        'this backend.',
    );
  }

  const session = (quill as Quill & {
    open(doc: Document): RenderSession;
  }).open(doc);
  try {
    const layoutScale = opts.layoutScale ?? 1;
    const densityScale =
      opts.densityScale ??
      (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const gap = opts.gapPx ?? 16;
    const pageCount = session.pageCount;

    if (signal.aborted) return -1;

    host.replaceChildren();
    host.style.setProperty('--qme-page-gap', `${gap}px`);

    if (pageCount === 0) return 0;

    const pages =
      opts.pages ?? Array.from({ length: pageCount }, (_, i) => i);

    for (const page of pages) {
      if (signal.aborted) return -1;
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      canvas.style.marginBottom = `${gap}px`;
      canvas.dataset.page = String(page);
      if (opts.canvasClass) canvas.classList.add(opts.canvasClass);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to acquire 2D canvas context');

      // 0.68 painter sizes `canvas.width` / `canvas.height` itself based on
      // (widthPt × layoutScale × densityScale). We read PaintResult to drive
      // the CSS layout box; never write `canvas.width` ourselves.
      const result: PaintResult = session.paint(ctx, page, {
        layoutScale,
        densityScale,
      });
      canvas.style.width = `${result.layoutWidth}px`;
      canvas.style.height = `${result.layoutHeight}px`;

      host.appendChild(canvas);
    }
    return pages.length;
  } finally {
    session.free();
  }
}
