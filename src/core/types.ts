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
 * Requires `@quillmark/wasm` ≥ 0.67.0 — the preview path uses
 * `Quill.open(doc).paint(ctx, page, scale)` from that release.
 */
export interface QuillmarkHost {
  /** Resolves once the wasm engine and quiver are ready. */
  isReady(): boolean;
  /** Wasm `Document` constructor. */
  readonly Document: typeof WasmDocument;
  /**
   * Synchronously fetch a resolved Quill. Throws if not yet resolved. The
   * returned handle exposes `.open(doc): RenderSession` (wasm 0.67+).
   */
  getQuill(quillRef: string): Quill;
  /** Resolve and load a quill so subsequent `getQuill` calls are synchronous. */
  ensureQuillResolved(quillRef: string): Promise<void>;
}

/** `RenderSession` from `@quillmark/wasm` 0.67+. */
export interface RenderSession {
  readonly pageCount: number;
  readonly backendId: string;
  pageSize(page: number): { widthPt: number; heightPt: number };
  paint(ctx: CanvasRenderingContext2D, page: number, scale: number): void;
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
