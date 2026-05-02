/**
 * `@quillmark/editor/core` — headless TS entry.
 *
 * No DOM, no framework. Server / AI-agent code uses `createEditorState`
 * directly; the same primitive backs the Svelte and custom-element UI.
 *
 * `@quillmark/wasm` is a peer dependency — hosts inject `Document` /
 * `getQuill()` / `isReady()` via `QuillmarkHost`. This module never imports
 * the wasm package at runtime.
 */

export { createEditorState, isEmptyValue } from './editor-state.js';
export type {
  EditorState,
  CreateEditorStateOptions,
} from './editor-state.js';

export type {
  Card,
  CardView,
  Diagnostic,
  Document,
  EditorTarget,
  FormSchema,
  QuillmarkHost,
  Quill,
  RenderSession,
  PaintNativeOptions,
  PaintResult,
  SchemaField,
  Subscriber,
  TelemetryEvent,
  TelemetryHandler,
  Unsubscribe,
  FeatureFlags,
} from './types.js';
export { DEFAULT_FEATURES } from './types.js';

export { paintPagesIntoElement } from './canvas-render.js';
export type { PaintOptions } from './canvas-render.js';
export { watchZoom } from './zoom-watcher.js';

export {
  walkSchema,
  validateFrontmatter,
  getQuillSchema,
  collectDatePaths,
} from './schema.js';
export type {
  FieldVisit,
  ValidationIssue,
  QuillSchemaDatePaths,
} from './schema.js';

export {
  insertCardAfter,
  moveCardBy,
  getBlankCardDefaults,
} from './commands.js';

// Lexical sub-namespace — the UI imports from here, but server consumers can
// also call `loadMarkdown` / `serializeMarkdown` against a Lexical editor
// they create themselves (e.g., for headless body transforms).
export { buildEditorConfig, EDITOR_NODES } from './lexical/config.js';
export { buildTransformers, UNDERLINE_UNDERSCORE } from './lexical/transformers.js';
export { loadMarkdown, serializeMarkdown } from './lexical/markdown-bridge.js';
export { defaultTheme } from './lexical/theme.js';
