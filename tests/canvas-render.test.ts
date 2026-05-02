/**
 * Canvas-render contract tests. Locks in the wasm 0.68 painter contract:
 * the painter owns `canvas.width`/`canvas.height` and reports layout-pixel
 * dimensions on `PaintResult`; the consumer owns `canvas.style.*`.
 *
 * Uses a fake `RenderSession` (no real wasm) to exercise the call shape.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { paintPagesIntoElement } from '../src/core/canvas-render.js';

// JSDOM ships a `<canvas>` element but no 2D context. Stub getContext so the
// painter has something to receive — the fake session below doesn't actually
// rasterize, so we can hand back a minimal object shaped like the real one.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
  ) {
    return { canvas: this } as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext'];
});
import type {
  Document,
  PaintNativeOptions,
  PaintResult,
  Quill,
  RenderSession,
} from '../src/core/types.js';

interface FakeSessionOptions {
  pageCount?: number;
  paintImpl?: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    page: number,
    opts?: PaintNativeOptions,
  ) => PaintResult;
}

function makeQuill(opts: {
  pageCount?: number;
  supportsCanvas?: boolean;
  paintImpl?: FakeSessionOptions['paintImpl'];
} = {}): { quill: Quill; paintCalls: Array<{ page: number; opts?: PaintNativeOptions }> } {
  const paintCalls: Array<{ page: number; opts?: PaintNativeOptions }> = [];
  const session: RenderSession = {
    pageCount: opts.pageCount ?? 1,
    backendId: 'typst',
    supportsCanvas: true,
    pageSize: (page) => ({ widthPt: 612, heightPt: 792 }),
    paint: (ctx, page, paintOpts) => {
      paintCalls.push({ page, opts: paintOpts });
      const layoutScale = paintOpts?.layoutScale ?? 1;
      const densityScale = paintOpts?.densityScale ?? 1;
      // Simulate the painter writing canvas.width / canvas.height.
      const target = ctx.canvas as HTMLCanvasElement;
      const layoutWidth = 612 * layoutScale;
      const layoutHeight = 792 * layoutScale;
      target.width = Math.round(layoutWidth * densityScale);
      target.height = Math.round(layoutHeight * densityScale);
      const result: PaintResult = {
        layoutWidth,
        layoutHeight,
        pixelWidth: target.width,
        pixelHeight: target.height,
      };
      return opts.paintImpl ? opts.paintImpl(ctx, page, paintOpts) : result;
    },
    free: vi.fn(),
  };
  const quill = {
    backendId: 'typst',
    supportsCanvas: opts.supportsCanvas ?? true,
    open: () => session,
    metadata: {},
  } as unknown as Quill;
  return { quill, paintCalls };
}

const fakeDoc = {} as unknown as Document;

describe('paintPagesIntoElement (wasm 0.68 paint contract)', () => {
  it('passes layoutScale / densityScale through to session.paint', () => {
    const { quill, paintCalls } = makeQuill({ pageCount: 2 });
    const host = document.createElement('div');
    const ac = new AbortController();

    const painted = paintPagesIntoElement(quill, fakeDoc, host, ac.signal, {
      layoutScale: 1.25,
      densityScale: 2,
    });

    expect(painted).toBe(2);
    expect(paintCalls).toHaveLength(2);
    expect(paintCalls[0]).toEqual({
      page: 0,
      opts: { layoutScale: 1.25, densityScale: 2 },
    });
    expect(paintCalls[1]?.page).toBe(1);
  });

  it('sets canvas.style.{width,height} from PaintResult layout dimensions and never sets canvas.width/height itself', () => {
    const { quill } = makeQuill({ pageCount: 1 });
    const host = document.createElement('div');
    const ac = new AbortController();

    paintPagesIntoElement(quill, fakeDoc, host, ac.signal, {
      layoutScale: 2,
      densityScale: 3,
    });

    const canvas = host.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    // layoutScale=2 → 612 * 2 = 1224 px display box.
    expect(canvas.style.width).toBe('1224px');
    expect(canvas.style.height).toBe('1584px');
    // densityScale=3 on top → 1224 * 3 = 3672 px backing store, written by
    // the (fake) painter, not by canvas-render.ts.
    expect(canvas.width).toBe(3672);
    expect(canvas.height).toBe(4752);
  });

  it('returns 0 for empty documents (pageCount === 0) and does not append a canvas', () => {
    const { quill, paintCalls } = makeQuill({ pageCount: 0 });
    const host = document.createElement('div');
    host.appendChild(document.createElement('span')); // pre-existing content
    const ac = new AbortController();

    const painted = paintPagesIntoElement(quill, fakeDoc, host, ac.signal);

    expect(painted).toBe(0);
    expect(paintCalls).toHaveLength(0);
    expect(host.querySelector('canvas')).toBeNull();
    // Host is still cleared (the contract: re-paint replaces host children).
    expect(host.querySelector('span')).toBeNull();
  });

  it('throws when Quill.supportsCanvas === false (precondition probe)', () => {
    const { quill } = makeQuill({ supportsCanvas: false });
    const host = document.createElement('div');
    const ac = new AbortController();

    expect(() => paintPagesIntoElement(quill, fakeDoc, host, ac.signal)).toThrow(
      /does not support canvas preview/,
    );
  });

  it('throws a friendly error when Quill.open is missing (older wasm bundle)', () => {
    const stale = { backendId: 'typst' } as unknown as Quill;
    const host = document.createElement('div');
    const ac = new AbortController();

    expect(() =>
      paintPagesIntoElement(stale, fakeDoc, host, ac.signal),
    ).toThrow(/@quillmark\/wasm ≥ 0\.68\.0 is required/);
  });

  it('aborts cleanly between pages when signal fires', () => {
    const { quill } = makeQuill({ pageCount: 5 });
    const host = document.createElement('div');
    const ac = new AbortController();
    let painted: number | null = null;

    const origPaint = quill.open(fakeDoc).paint;
    const session = quill.open(fakeDoc);
    let paintCallCount = 0;
    (session as unknown as { paint: typeof origPaint }).paint = (ctx, page, opts) => {
      paintCallCount++;
      if (paintCallCount === 2) ac.abort();
      return origPaint.call(session, ctx, page, opts);
    };
    (quill as unknown as { open: () => RenderSession }).open = () => session;

    painted = paintPagesIntoElement(quill, fakeDoc, host, ac.signal);
    expect(painted).toBe(-1);
  });
});
