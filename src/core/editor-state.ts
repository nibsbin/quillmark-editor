/**
 * EditorState — canonical primitive shared by VisualEditor, QuillmarkPreview,
 * and headless consumers. Wraps a `@quillmark/wasm` `Document`.
 *
 * Framework-neutral: reactivity is plain pub-sub (`subscribe(cb)` returns
 * `unsubscribe`). Svelte hosts adapt this to runes via `useEditor(state)`.
 *
 * Contract per PROGRAM.md §5: mutations bump `version`; consumers re-read
 * after the bump. No round-trip to markdown between mutations.
 */

import type {
  Card,
  CardView,
  Diagnostic,
  Document,
  EditorTarget,
  FormSchema,
  QuillmarkHost,
  Subscriber,
  Unsubscribe,
} from './types.js';

/**
 * Determines whether a value is "empty" at the YAML write boundary.
 * Empty values are removed from the document; non-empty values are written.
 *
 * When `type` is undefined, only null/undefined count as empty (preserves 0, false, '').
 */
export function isEmptyValue(value: unknown, type?: string): boolean {
  switch (type) {
    case 'string':
      return typeof value !== 'string' || value.trim() === '';
    case 'array':
      return !Array.isArray(value) || value.length === 0;
    case 'number':
    case 'integer':
      return value === null || value === undefined;
    case 'boolean':
      return false;
    default:
      return value === null || value === undefined;
  }
}

function diagnosticsFromError(err: unknown): Diagnostic[] {
  if (err && typeof err === 'object' && 'diagnostics' in err) {
    const list = (err as { diagnostics?: unknown }).diagnostics;
    if (Array.isArray(list) && list.length > 0) return list as Diagnostic[];
  }
  const message = err instanceof Error ? err.message : String(err);
  return [{ severity: 'error', message, sourceChain: [] } as unknown as Diagnostic];
}

export interface CreateEditorStateOptions {
  quillmark: QuillmarkHost;
}

/**
 * Public handle. UI components and headless consumers depend on this shape;
 * the implementation class is internal.
 */
export interface EditorState {
  /** Monotonically increasing version — bumps on every mutation. */
  readonly version: number;

  /** True after a successful `load()`. */
  readonly isInitialized: boolean;

  /** Parse-time diagnostics (warnings on success, error chain on failure). */
  readonly diagnostics: readonly Diagnostic[];

  /** Resolved canonical quill ref, or `''` when unset. */
  readonly quillRef: string;

  /** Primary card frontmatter. */
  readonly mainFrontmatter: Record<string, unknown>;

  /** Primary card body (markdown). */
  readonly mainBody: string;

  /** Card list (positional). */
  readonly cards: readonly CardView[];

  /** Live `Document` handle. Use sparingly; mutations should go through the methods below. */
  readonly document: Document | null;

  /** Cached injection target for downstream UI. */
  readonly quillmark: QuillmarkHost;

  /**
   * Parse `markdown` and replace the underlying `Document`. Async-by-default —
   * awaits `quillmark.isReady()` so callers don't have to gate this themselves.
   */
  load(markdown: string): Promise<void>;

  /** Synchronously serialize the current `Document` to canonical Quillmark Markdown. */
  toMarkdown(): string;

  /** Read a card by positional index. */
  getCard(index: number): CardView | undefined;

  /** Replace the QUILL frontmatter directive (the only field with a dedicated wasm primitive). */
  setQuillRef(ref: string): void;

  /** Replace the body of the primary card. */
  setMainBody(body: string): void;

  /** Replace a card body by index. Stale indices are silently dropped. */
  setCardBody(index: number, body: string): void;

  /** Set/clear a single field on the primary card. */
  setMainField(name: string, value: unknown, fieldType?: string): void;

  /** Batch update of primary-card fields. */
  setMainFields(entries: Record<string, unknown>, fieldTypes?: Record<string, string>): void;

  /** Set/clear a single field on a card. */
  setCardField(index: number, name: string, value: unknown, fieldType?: string): void;

  /** Batch update of fields on one card. */
  setCardFields(
    index: number,
    entries: Record<string, unknown>,
    fieldTypes?: Record<string, string>,
  ): void;

  /**
   * Insert a new card at `index` with the given tag. Returns the new index, or
   * -1 when the document hasn't loaded.
   */
  addCard(index: number, tag: string, fields?: Record<string, unknown>): number;

  /** Remove a card. Returns true on success, false when index was out of range. */
  removeCard(index: number): boolean;

  /** Move a card. Returns true on success. */
  moveCard(from: number, to: number): boolean;

  /** Re-tag a card; preserves frontmatter and body. */
  setCardTag(index: number, tag: string): void;

  /**
   * Synchronously check whether a markdown string would parse to a `Document`
   * structurally equal to the current one. Useful for echo suppression.
   */
  equalsMarkdown(markdown: string): boolean;

  /** Subscribe to mutations. Returns unsubscribe. */
  subscribe(cb: Subscriber): Unsubscribe;

  /** Eagerly free the wasm `Document` (optional with `--weak-refs`). */
  destroy(): void;
}

class EditorStateImpl implements EditorState {
  readonly quillmark: QuillmarkHost;

  #version = 0;
  #doc: Document | null = null;
  #diagnostics: Diagnostic[] = [];
  #subscribers = new Set<Subscriber>();

  constructor(opts: CreateEditorStateOptions) {
    this.quillmark = opts.quillmark;
  }

  get version(): number {
    return this.#version;
  }
  get isInitialized(): boolean {
    return this.#doc !== null;
  }
  get diagnostics(): readonly Diagnostic[] {
    return this.#diagnostics;
  }
  get document(): Document | null {
    return this.#doc;
  }
  get quillRef(): string {
    return this.#doc?.quillRef ?? '';
  }
  get mainFrontmatter(): Record<string, unknown> {
    return (this.#doc?.main.frontmatter as Record<string, unknown>) ?? {};
  }
  get mainBody(): string {
    return this.#doc?.main.body ?? '';
  }
  get cards(): readonly CardView[] {
    return this.#doc?.cards ?? [];
  }

  async load(markdown: string): Promise<void> {
    // Yield once so callers awaiting wasm init can be sure the engine is up.
    if (!this.quillmark.isReady()) {
      await waitFor(() => this.quillmark.isReady(), 5000);
    }
    let next: Document;
    try {
      next = this.quillmark.Document.fromMarkdown(markdown);
    } catch (err) {
      this.#diagnostics = diagnosticsFromError(err);
      this.#bump();
      throw err;
    }
    if (this.#doc?.equals(next)) {
      this.#diagnostics = next.warnings as Diagnostic[];
      // No structural change — no version bump (avoids spurious re-renders).
      return;
    }
    this.#doc = next;
    this.#diagnostics = next.warnings as Diagnostic[];
    this.#bump();
  }

  toMarkdown(): string {
    return this.#doc?.toMarkdown() ?? '';
  }

  getCard(index: number): CardView | undefined {
    return this.#doc?.cards[index];
  }

  setQuillRef(ref: string): void {
    if (!this.#doc) return;
    this.#doc.setQuillRef(ref);
    this.#bump();
  }

  setMainBody(body: string): void {
    if (!this.#doc) return;
    this.#doc.replaceBody(body);
    this.#bump();
  }

  setCardBody(index: number, body: string): void {
    if (!this.#doc) return;
    if (index < 0 || index >= this.#doc.cardCount) return;
    this.#doc.updateCardBody(index, body);
    this.#bump();
  }

  setMainField(name: string, value: unknown, fieldType?: string): void {
    if (!this.#doc) return;
    if (isEmptyValue(value, fieldType)) {
      this.#doc.removeField(name);
    } else {
      this.#doc.setField(name, value);
    }
    this.#bump();
  }

  setMainFields(entries: Record<string, unknown>, fieldTypes?: Record<string, string>): void {
    if (!this.#doc) return;
    for (const [name, value] of Object.entries(entries)) {
      if (isEmptyValue(value, fieldTypes?.[name])) {
        this.#doc.removeField(name);
      } else {
        this.#doc.setField(name, value);
      }
    }
    this.#bump();
  }

  setCardField(index: number, name: string, value: unknown, fieldType?: string): void {
    if (!this.#doc) return;
    if (index < 0 || index >= this.#doc.cardCount) return;
    if (isEmptyValue(value, fieldType)) {
      this.#doc.removeCardField(index, name);
    } else {
      this.#doc.updateCardField(index, name, value);
    }
    this.#bump();
  }

  setCardFields(
    index: number,
    entries: Record<string, unknown>,
    fieldTypes?: Record<string, string>,
  ): void {
    if (!this.#doc) return;
    if (index < 0 || index >= this.#doc.cardCount) return;
    for (const [name, value] of Object.entries(entries)) {
      if (isEmptyValue(value, fieldTypes?.[name])) {
        this.#doc.removeCardField(index, name);
      } else {
        this.#doc.updateCardField(index, name, value);
      }
    }
    this.#bump();
  }

  addCard(index: number, tag: string, fields: Record<string, unknown> = {}): number {
    if (!this.#doc) return -1;
    const clamped = Math.max(0, Math.min(index, this.#doc.cardCount));
    this.#doc.insertCard(clamped, { tag, fields, body: '' } as unknown as Card);
    this.#bump();
    return clamped;
  }

  removeCard(index: number): boolean {
    if (!this.#doc) return false;
    if (index < 0 || index >= this.#doc.cardCount) return false;
    const removed = this.#doc.removeCard(index);
    if (removed) this.#bump();
    return Boolean(removed);
  }

  moveCard(from: number, to: number): boolean {
    if (!this.#doc) return false;
    const total = this.#doc.cardCount;
    if (from < 0 || from >= total || to < 0 || to >= total || from === to) return false;
    this.#doc.moveCard(from, to);
    this.#bump();
    return true;
  }

  setCardTag(index: number, tag: string): void {
    if (!this.#doc) return;
    if (index < 0 || index >= this.#doc.cardCount) return;
    const card = this.#doc.cards[index];
    if (!card || card.tag === tag) return;
    this.#doc.setCardTag(index, tag);
    this.#bump();
  }

  equalsMarkdown(markdown: string): boolean {
    if (!this.#doc) return false;
    try {
      const probe = this.quillmark.Document.fromMarkdown(markdown);
      const eq = this.#doc.equals(probe);
      probe.free?.();
      return eq;
    } catch {
      return false;
    }
  }

  subscribe(cb: Subscriber): Unsubscribe {
    this.#subscribers.add(cb);
    return () => this.#subscribers.delete(cb);
  }

  destroy(): void {
    this.#doc?.free?.();
    this.#doc = null;
    this.#subscribers.clear();
  }

  #bump(): void {
    this.#version++;
    for (const cb of this.#subscribers) {
      try {
        cb(this.#version);
      } catch (err) {
        // Subscribers must not throw across the bus.
        console.error('[EditorState] subscriber threw:', err);
      }
    }
  }
}

/**
 * Poll-and-wait utility used by `load()` so callers don't have to manually
 * gate on `isReady()`. Synchronous on the happy path (immediate resolve).
 */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  if (predicate()) return;
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('QuillmarkHost.isReady() did not resolve within timeout'));
      }
      setTimeout(tick, 16);
    };
    tick();
  });
}

/**
 * Canonical primitive — both UI components and headless consumers create one
 * of these. Per §5, hosts inject `QuillmarkHost`; the package never bundles
 * `@quillmark/wasm`.
 */
export function createEditorState(opts: CreateEditorStateOptions): EditorState {
  return new EditorStateImpl(opts);
}

/** Re-export the schema helper so consumers don't have to reach into the schema module. */
export type { FormSchema, EditorTarget } from './types.js';
