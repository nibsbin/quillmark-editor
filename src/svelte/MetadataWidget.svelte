<script lang="ts">
  /**
   * MetadataWidget — schema-driven form binding to the EditorState.
   *
   * Renders text / number / boolean / enum / date / array-of-string /
   * nested-object fields based on `quill.metadata.schema`. Forwards-compatible:
   * unknown types render as a plain text input.
   *
   * V1 omits the rich array editor (drag-to-reorder rows of nested fields)
   * and the date picker UX from tonguetoquill-web — both are open issues
   * that block on the schema-walker contract; the V1 form is functional but
   * intentionally plain.
   */

  import type { EditorState, EditorTarget, FormSchema, SchemaField } from '../core/index.js';

  interface Props {
    state: EditorState;
    schema: FormSchema | null;
    target: EditorTarget;
    onChange?: () => void;
  }

  let { state: editorState, schema, target, onChange }: Props = $props();

  const fields = $derived<[string, SchemaField][]>(
    schema?.fields ? Object.entries(schema.fields) : [],
  );

  const values = $derived.by<Record<string, unknown>>(() => {
    void editorState.version;
    if (target.kind === 'main') return editorState.mainFrontmatter;
    return (editorState.getCard(target.index)?.frontmatter as Record<string, unknown>) ?? {};
  });

  function setField(name: string, value: unknown, fieldType?: string) {
    if (target.kind === 'main') {
      editorState.setMainField(name, value, fieldType);
    } else {
      editorState.setCardField(target.index, name, value, fieldType);
    }
    onChange?.();
  }

  function handleString(name: string, ev: Event, fieldType: string) {
    const target = ev.target as HTMLInputElement | HTMLTextAreaElement;
    setField(name, target.value, fieldType);
  }

  function handleNumber(name: string, ev: Event, fieldType: string) {
    const t = ev.target as HTMLInputElement;
    const raw = t.value;
    const v = raw === '' ? null : Number(raw);
    if (raw !== '' && Number.isNaN(v)) return;
    setField(name, v, fieldType);
  }

  function handleBoolean(name: string, ev: Event) {
    const t = ev.target as HTMLInputElement;
    setField(name, t.checked, 'boolean');
  }

  function handleEnum(name: string, ev: Event, fieldType: string) {
    const t = ev.target as HTMLSelectElement;
    setField(name, t.value, fieldType);
  }

  function handleArrayOfString(name: string, ev: Event) {
    const t = ev.target as HTMLTextAreaElement;
    const items = t.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setField(name, items, 'array');
  }

  function arrayPreview(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value.map((v) => String(v)).join('\n');
  }
</script>

<div class="qme-metadata">
  {#if fields.length === 0}
    <!-- No schema fields to render. Empty by design. -->
  {:else}
    {#each fields as [name, field] (name)}
      {@const v = values[name]}
      {@const label = field.title ?? name}
      <div class="qme-field" data-field={name}>
        <label class="qme-label" for="qme-{name}">
          {label}
          {#if field.required}<span aria-label="required">*</span>{/if}
        </label>

        {#if field.enum}
          <select
            id="qme-{name}"
            class="qme-input"
            value={v ?? ''}
            onchange={(e) => handleEnum(name, e, field.type ?? 'string')}
          >
            <option value="">—</option>
            {#each field.enum as option}
              <option value={String(option)}>{String(option)}</option>
            {/each}
          </select>
        {:else if field.type === 'boolean'}
          <input
            id="qme-{name}"
            type="checkbox"
            checked={Boolean(v)}
            onchange={(e) => handleBoolean(name, e)}
          />
        {:else if field.type === 'number' || field.type === 'integer'}
          <input
            id="qme-{name}"
            type="number"
            class="qme-input"
            step={field.type === 'integer' ? 1 : 'any'}
            value={v == null ? '' : Number(v)}
            oninput={(e) => handleNumber(name, e, field.type ?? 'number')}
          />
        {:else if field.type === 'date'}
          <input
            id="qme-{name}"
            type="date"
            class="qme-input"
            value={typeof v === 'string' ? v : ''}
            onchange={(e) => handleString(name, e, 'string')}
          />
        {:else if field.type === 'array' && (field.items as { type?: string } | undefined)?.type === 'string'}
          <textarea
            id="qme-{name}"
            class="qme-input qme-textarea"
            rows="3"
            value={arrayPreview(v)}
            oninput={(e) => handleArrayOfString(name, e)}
            placeholder="One item per line"
          ></textarea>
        {:else if (field.ui as { multiline?: boolean } | undefined)?.multiline}
          <textarea
            id="qme-{name}"
            class="qme-input qme-textarea"
            rows="3"
            value={typeof v === 'string' ? v : ''}
            oninput={(e) => handleString(name, e, 'string')}
          ></textarea>
        {:else}
          <input
            id="qme-{name}"
            type="text"
            class="qme-input"
            value={typeof v === 'string' ? v : v == null ? '' : String(v)}
            oninput={(e) => handleString(name, e, field.type ?? 'string')}
          />
        {/if}

        {#if field.description}
          <p class="qme-help">{field.description}</p>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .qme-metadata {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem 1rem;
    padding: 0.75rem 1rem;
    background: var(--qme-metadata-bg, transparent);
  }
  .qme-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .qme-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--qme-label, #475569);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .qme-input {
    width: 100%;
    border: 1px solid var(--qme-border, #cbd5e1);
    border-radius: 4px;
    padding: 0.375rem 0.5rem;
    font: inherit;
    background: var(--qme-input-bg, #fff);
    color: inherit;
    box-sizing: border-box;
  }
  .qme-input:focus {
    outline: 2px solid var(--qme-focus, #3b82f6);
    outline-offset: 1px;
    border-color: transparent;
  }
  .qme-textarea {
    resize: vertical;
    font-family: inherit;
  }
  .qme-help {
    margin: 0;
    font-size: 0.75rem;
    color: var(--qme-muted, #94a3b8);
  }
</style>
