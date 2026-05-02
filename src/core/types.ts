/**
 * Type definitions for `@quillmark/editor/core`.
 *
 * The package never imports `@quillmark/wasm` directly. Hosts inject it via
 * `QuillmarkHost`, matching tonguetoquill-web's `quillmarkService` pattern.
 * Types here describe the slice of the wasm surface the editor depends on.
 */

import type {
  Document as WasmDocument,
  Card as WasmCard,
  Diagnostic as WasmDiagnostic,
  Quill as WasmQuill,
} from '@quillmark/wasm';

export type Document = WasmDocument;
export type Card = WasmCard;
export type Diagnostic = WasmDiagnostic;
export type Quill = WasmQuill;

/**
 * Slice of `@quillmark/wasm`'s service surface the editor depends on.
 * tonguetoquill-web's `quillmarkService` satisfies this shape.
 *
 * Requires `@quillmark/wasm` ≥ 0.68.0 — the preview path uses
 * `Quill.open(doc).paint(ctx, page, opts) → PaintResult` from that release.
 */
export interface QuillmarkHost {
  /** Resolves once the wasm engine and quiver are ready. */
  isReady(): boolean;
  /** Wasm `Document` constructor. */
  readonly Document: typeof WasmDocument;
  /**
   * Synchronously fetch a resolved Quill. Throws if not yet resolved. The
   * returned handle exposes `.open(doc): RenderSession` and
   * `.supportsCanvas: boolean` (wasm 0.68+).
   */
  getQuill(quillRef: string): Quill;
  /** Resolve and load a quill so subsequent `getQuill` calls are synchronous. */
  ensureQuillResolved(quillRef: string): Promise<void>;
}

/**
 * `RenderSession` from `@quillmark/wasm` 0.68+.
 *
 * The painter owns `canvas.width` / `canvas.height`; consumers own
 * `canvas.style.*` and read the layout-pixel dimensions from `PaintResult`.
 * `layoutScale` and `densityScale` decouple display-box size from
 * backing-store density — fold `window.devicePixelRatio`, in-app zoom,
 * and pinch-zoom into `densityScale`.
 */
export interface PaintNativeOptions {
  /** Layout-space pixels per Typst point. Default 1 (1 pt → 1 CSS px). */
  layoutScale?: number;
  /** Backing-store density multiplier. Default 1. Pass DPR × zoom for crispness. */
  densityScale?: number;
}

export interface PaintResult {
  /** CSS-pixel display-box width — assign to `canvas.style.width + "px"`. */
  layoutWidth: number;
  /** CSS-pixel display-box height — assign to `canvas.style.height + "px"`. */
  layoutHeight: number;
  /** Backing-store width in device pixels (the painter wrote `canvas.width`). */
  pixelWidth: number;
  /** Backing-store height in device pixels (the painter wrote `canvas.height`). */
  pixelHeight: number;
}

export interface RenderSession {
  readonly pageCount: number;
  readonly backendId: string;
  /** `true` iff `paint` / `pageSize` will succeed for this session. */
  readonly supportsCanvas: boolean;
  pageSize(page: number): { widthPt: number; heightPt: number };
  paint(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    page: number,
    opts?: PaintNativeOptions,
  ): PaintResult;
  free(): void;
}

/** Mutation target — main card or a positional card. */
export type EditorTarget = { kind: 'main' } | { kind: 'card'; index: number };

/** Card view consumed by UI; mirrors `@quillmark/wasm` `Card`. */
export type CardView = Card;

/**
 * One field's schema entry inside a `Form.schema.fields` map. Mirrors the
 * wasm-exposed shape; we deliberately don't enumerate every key — forwards-
 * compatible additions are tolerated.
 */
export interface SchemaField {
  name: string;
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  enum?: readonly unknown[];
  fields?: Record<string, SchemaField>;
  items?: SchemaField | { type?: string; fields?: Record<string, SchemaField> };
  ui?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FormSchema {
  name?: string;
  title?: string;
  description?: string;
  fields: Record<string, SchemaField>;
  ui?: Record<string, unknown>;
}

/**
 * Subscriber callback. Receives the new version count; consumer reads off
 * the `EditorState` directly.
 */
export type Subscriber = (version: number) => void;
export type Unsubscribe = () => void;

/** Telemetry hook payload. */
export interface TelemetryEvent {
  name: string;
  detail?: Record<string, unknown>;
}
export type TelemetryHandler = (event: TelemetryEvent) => void;

/** Feature flags exposed on the VisualEditor. */
export interface FeatureFlags {
  tables?: boolean;
  cards?: boolean;
  dragDrop?: boolean;
  links?: boolean;
  code?: boolean;
}

export const DEFAULT_FEATURES: Required<FeatureFlags> = {
  tables: true,
  cards: true,
  dragDrop: true,
  links: true,
  code: true,
};
