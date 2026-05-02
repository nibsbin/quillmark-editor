/**
 * Schema walker & validator (resolves PROGRAM.md O7).
 *
 * The schema *format* is owned by `@quillmark/wasm` (`quill.metadata.schema`).
 * We expose a typed walker so server / agent consumers don't have to re-derive
 * traversal & validation, and date-path collection used by the legacy date
 * migration.
 *
 * No DOM dependency — safe to import in `core` and call from Node.
 */

import type { FormSchema, Quill, SchemaField } from './types.js';

interface QuillNativeMetadata {
  supportedFormats?: string[];
  schema?: {
    name?: string;
    main?: FormSchema;
    card_types?: Record<string, FormSchema>;
    example?: string;
  };
}

/**
 * Read the static schema attached to a resolved Quill. Returns `null` when
 * the metadata shape doesn't carry a schema (host quills without a form
 * definition still resolve, but expose nothing to walk).
 */
export function getQuillSchema(quill: Quill): {
  main?: FormSchema;
  cardTypes?: Record<string, FormSchema>;
} | null {
  const meta = quill.metadata as QuillNativeMetadata;
  if (!meta.schema) return null;
  return {
    main: meta.schema.main,
    cardTypes: meta.schema.card_types,
  };
}

export interface FieldVisit {
  path: string;
  field: SchemaField;
  parent: SchemaField | null;
  depth: number;
}

/**
 * Walk every leaf and intermediate field in a `FormSchema`. Object fields
 * recurse; array fields recurse with `*` in the path segment. Visitor
 * receives `path` joined by `.`.
 */
export function walkSchema(
  schema: FormSchema | null | undefined,
  visit: (v: FieldVisit) => void,
): void {
  if (!schema?.fields) return;
  walkFields(schema.fields, '', null, 0, visit);
}

function walkFields(
  fields: Record<string, SchemaField>,
  prefix: string,
  parent: SchemaField | null,
  depth: number,
  visit: (v: FieldVisit) => void,
): void {
  for (const [name, raw] of Object.entries(fields)) {
    if (!raw || typeof raw !== 'object') continue;
    const field = raw as SchemaField;
    const path = prefix ? `${prefix}.${name}` : name;
    visit({ path, field, parent, depth });

    const nested = field.fields;
    const itemFields =
      field.type === 'array' && field.items && typeof field.items === 'object'
        ? (field.items as { fields?: Record<string, SchemaField> }).fields
        : undefined;

    if (field.type === 'object' && nested) {
      walkFields(nested, path, field, depth + 1, visit);
    } else if (field.type !== 'array' && nested) {
      walkFields(nested, path, field, depth + 1, visit);
    } else if (itemFields) {
      walkFields(itemFields, `${path}.*`, field, depth + 1, visit);
    }
  }
}

/**
 * All `type: date` field paths for a quill — used by the legacy date
 * migration in tonguetoquill-web. Mirrors the existing `collectDatePaths`
 * helper but with no transient documents.
 */
export interface QuillSchemaDatePaths {
  frontmatter: readonly string[];
  cards: ReadonlyMap<string, readonly string[]>;
}

export function collectDatePaths(quill: Quill): QuillSchemaDatePaths {
  const meta = quill.metadata as QuillNativeMetadata;
  const frontmatter = collectDatePathsFromSchema(meta.schema?.main);
  const cards = new Map<string, readonly string[]>();
  const cardTypes = meta.schema?.card_types ?? {};
  for (const [tag, schema] of Object.entries(cardTypes)) {
    cards.set(tag, collectDatePathsFromSchema(schema));
  }
  return { frontmatter, cards };
}

function collectDatePathsFromSchema(schema: FormSchema | undefined): readonly string[] {
  const out: string[] = [];
  walkSchema(schema, ({ path, field }) => {
    if (field.type === 'date') out.push(path);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate one frontmatter blob against a `FormSchema`. Forwards-compatible —
 * unknown types pass; only required fields and explicit type/enum mismatches
 * are flagged. Server / agent code can call this directly.
 */
export function validateFrontmatter(
  values: Record<string, unknown>,
  schema: FormSchema | null | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!schema?.fields) return issues;
  for (const [name, field] of Object.entries(schema.fields)) {
    const v = values[name];
    if (field.required && (v === undefined || v === null || v === '')) {
      issues.push({ path: name, message: `${name} is required`, severity: 'error' });
      continue;
    }
    if (v === undefined || v === null) continue;
    const typeIssue = checkType(v, field);
    if (typeIssue) issues.push({ path: name, message: typeIssue, severity: 'error' });
    if (field.enum && !field.enum.includes(v)) {
      issues.push({
        path: name,
        message: `${name} must be one of: ${field.enum.map(String).join(', ')}`,
        severity: 'error',
      });
    }
  }
  return issues;
}

function checkType(value: unknown, field: SchemaField): string | null {
  switch (field.type) {
    case 'string':
      return typeof value === 'string' ? null : `${field.name ?? ''} expected string`;
    case 'number':
    case 'integer':
      return typeof value === 'number' ? null : `${field.name ?? ''} expected number`;
    case 'boolean':
      return typeof value === 'boolean' ? null : `${field.name ?? ''} expected boolean`;
    case 'array':
      return Array.isArray(value) ? null : `${field.name ?? ''} expected array`;
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value)
        ? null
        : `${field.name ?? ''} expected object`;
    default:
      // Unknown / forwards-compatible types pass.
      return null;
  }
}
