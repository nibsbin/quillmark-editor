/**
 * `@quillmark/editor` — Svelte 5 entry.
 *
 * Re-exports the core primitive (`createEditorState`) so a Svelte host doesn't
 * need to dual-import from `/core`. The components are tree-shakable; a host
 * that only mounts `<QuillmarkPreview>` won't pull in BodyEditor's Lexical
 * surface.
 */

export { default as VisualEditor } from './VisualEditor.svelte';
export { default as QuillmarkPreview } from './QuillmarkPreview.svelte';
export { default as BodyEditor } from './BodyEditor.svelte';
export { default as MetadataWidget } from './MetadataWidget.svelte';

export { useEditor } from './use-editor.svelte.js';
export type { SvelteEditorView } from './use-editor.svelte.js';

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
