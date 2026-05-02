/**
 * `@quillmark/editor/element` — self-contained custom-element bundle.
 *
 * Importing this module side-effectfully registers `<quillmark-editor>` and
 * `<quillmark-preview>` with the global custom-element registry. It also
 * re-exports `createEditorState` so co-located scripts in the same realm
 * can share the canonical EditorState primitive without serializing through
 * markdown.
 *
 * Bundles the Svelte runtime and Lexical. `@quillmark/wasm` is left external —
 * the host injects it via `state.quillmark` per PROGRAM.md §2.
 */

import './QuillmarkEditorElement.svelte';
import './QuillmarkPreviewElement.svelte';

export {
  createEditorState,
  isEmptyValue,
  walkSchema,
  validateFrontmatter,
  getQuillSchema,
  collectDatePaths,
  insertCardAfter,
  moveCardBy,
  getBlankCardDefaults,
  buildEditorConfig,
  buildTransformers,
  loadMarkdown,
  serializeMarkdown,
  defaultTheme,
  paintPagesIntoElement,
  EDITOR_NODES,
  UNDERLINE_UNDERSCORE,
  DEFAULT_FEATURES,
} from '../core/index.js';

export type {
  EditorState,
  CreateEditorStateOptions,
  Card,
  CardView,
  Diagnostic,
  Document,
  EditorTarget,
  FormSchema,
  QuillmarkHost,
  Quill,
  RenderSession,
  SchemaField,
  Subscriber,
  TelemetryEvent,
  TelemetryHandler,
  Unsubscribe,
  FeatureFlags,
  FieldVisit,
  ValidationIssue,
  QuillSchemaDatePaths,
  PaintOptions,
} from '../core/index.js';
