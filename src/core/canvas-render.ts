/**
 * Canvas-based preview rendering, built on `@quillmark/wasm` ≥ 0.67's
 * `Quill.open(doc) → RenderSession.paint(ctx, page, scale)` primitive.
 *
 * This is the *primary* preview path: `<QuillmarkPreview>` calls
 * `paintPagesIntoElement` directly. There is no SVG fallback — hosts wanting
 * a different render strategy should not use `<QuillmarkPreview>` at all and
 * compose their own UI atop `EditorState`.
 *
 * Intentional contract differences from the §5.4 design:
 *   - The package now imports a renderer; preview-less consumers still pay
 *     zero render cost because tree-shaking drops this module unless they
 *     actually mount `<QuillmarkPreview>`.
 *   - `QuillmarkPreview` no longer takes a `render` prop. The Canvas path is
 *     the only path.
 *
 * Trade-offs (see PROGRAM.md follow-up): no text selection, no screen-reader
 * coverage of preview content, browser-zoom blurs until repaint. Acceptable
 * for V1; revisit when the post-spike list of UX gaps is triaged.
 */

import type { Document, Quill } from './types.js';

export interface PaintOptions {
  /**
   * Device-pixel-ratio multiplier for the canvas backing store. Default:
   * `window.devicePixelRatio || 1`. Hosts can override (e.g. for export-to-PNG
   * use cases that want a fixed resolution).
   */
  scale?: number;
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
 * Returns the number of pages painted (or -1 if aborted before paint).
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
      '@quillmark/wasm ≥ 0.67.0 is required for canvas preview ' +
        '(Quill.open(doc) is missing on the resolved Quill). ' +
        'Update the host\'s @quillmark/wasm peer-dep.',
    );
  }
  const session = (quill as Quill & {
    open(doc: Document): import('./types.js').RenderSession;
  }).open(doc);
  try {
    const scale = opts.scale ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const gap = opts.gapPx ?? 16;
    const pages =
      opts.pages ?? Array.from({ length: session.pageCount }, (_, i) => i);

    if (signal.aborted) return -1;

    host.replaceChildren();
    host.style.setProperty('--qme-page-gap', `${gap}px`);

    for (const page of pages) {
      if (signal.aborted) return -1;
      const { widthPt, heightPt } = session.pageSize(page);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(widthPt * scale);
      canvas.height = Math.round(heightPt * scale);
      // CSS box stays in points so layout doesn't depend on devicePixelRatio.
      canvas.style.width = `${widthPt}px`;
      canvas.style.height = `${heightPt}px`;
      canvas.style.display = 'block';
      canvas.style.marginBottom = `${gap}px`;
      canvas.dataset.page = String(page);
      if (opts.canvasClass) canvas.classList.add(opts.canvasClass);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to acquire 2D canvas context');
      session.paint(ctx, page, scale);
      host.appendChild(canvas);
    }
    return pages.length;
  } finally {
    session.free();
  }
}
