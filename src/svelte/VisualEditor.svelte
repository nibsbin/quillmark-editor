<script lang="ts">
  /**
   * VisualEditor — top-level rich-text editor.
   *
   * Composes: classification banner, parse-diagnostics banner, toolbar,
   * primary section (frontmatter form + body), card list (frontmatter +
   * body, with add/move/delete controls).
   *
   * Layout (split panes, tabs, modal) is the host's responsibility — see
   * PROGRAM.md §5.1. The package ships no layout primitive.
   */

  import { onDestroy } from 'svelte';
  import type {
    EditorState,
    FeatureFlags,
    FormSchema,
    TelemetryHandler,
  } from '../core/index.js';
  import { DEFAULT_FEATURES, getBlankCardDefaults } from '../core/index.js';
  import BodyEditor from './BodyEditor.svelte';
  import MetadataWidget from './MetadataWidget.svelte';
  import EditorBlock from './EditorBlock.svelte';
  import AddCardTrigger from './AddCardTrigger.svelte';
  import CardTypePicker from './CardTypePicker.svelte';
  import Toolbar from './Toolbar.svelte';
  import { useEditor } from './use-editor.svelte.js';

  interface ClassificationConfig {
    banner?: string;
    bannerPosition?: 'top' | 'bottom';
  }

  interface Props {
    state: EditorState;
    theme?: 'light' | 'dark' | 'auto' | Record<string, string>;
    features?: FeatureFlags;
    classification?: ClassificationConfig;
    onTelemetry?: TelemetryHandler;
    onParseFallback?: (err: unknown) => void;
    /** Active card position. `'main'` = primary doc; number = positional card. */
    activeCardId?: number | 'main' | null;
    onActiveCardIdChange?: (id: number | 'main' | null) => void;
  }

  let {
    state: editorState,
    theme = 'auto',
    features = {},
    classification,
    onTelemetry,
    onParseFallback,
    activeCardId = $bindable(null),
    onActiveCardIdChange,
  }: Props = $props();

  // `editorState` is a stable handle for the component lifetime — the public
  // contract treats it as constant, so referencing it directly here is safe.
  // svelte-ignore state_referenced_locally
  const editor = useEditor(editorState);
  const flags = $derived({ ...DEFAULT_FEATURES, ...features });

  let primary: BodyEditor | undefined = $state();
  let cardEditors: Record<number, BodyEditor | undefined> = $state({});

  let placeholderInsertAt: number | null = $state(null);
  let bannerDismissed = $state(false);
  let bodyParseFallback = $state<string | null>(null);
  let activeBodyEditor = $state<BodyEditor | null>(null);

  const cardTypes: readonly string[] = $derived.by(() => {
    const ref = editor.quillRef;
    if (!ref) return [] as readonly string[];
    try {
      const meta = editorState.quillmark.getQuill(ref).metadata as {
        schema?: { card_types?: Record<string, unknown> };
      };
      return Object.freeze(Object.keys(meta.schema?.card_types ?? {}));
    } catch {
      return [] as readonly string[];
    }
  });

  const quillSchema = $derived.by<{
    main?: FormSchema;
    cardTypes?: Record<string, FormSchema>;
  } | null>(() => {
    const ref = editor.quillRef;
    if (!ref) return null;
    try {
      const meta = editorState.quillmark.getQuill(ref).metadata as {
        schema?: { main?: FormSchema; card_types?: Record<string, FormSchema> };
      };
      if (!meta.schema) return null;
      return { main: meta.schema.main, cardTypes: meta.schema.card_types };
    } catch {
      return null;
    }
  });

  const mainSchema = $derived<FormSchema | null>(quillSchema?.main ?? null);
  const mainHideBody = $derived<boolean>(
    Boolean((mainSchema?.ui as Record<string, unknown> | undefined)?.hide_body),
  );
  function cardSchemaForTag(tag: string): FormSchema | null {
    return quillSchema?.cardTypes?.[tag] ?? null;
  }
  function cardHideBody(tag: string): boolean {
    return Boolean(
      (cardSchemaForTag(tag)?.ui as Record<string, unknown> | undefined)?.hide_body,
    );
  }

  function setActive(id: number | 'main' | null) {
    activeCardId = id;
    onActiveCardIdChange?.(id);
    if (id === 'main') {
      activeBodyEditor = primary ?? null;
    } else if (typeof id === 'number') {
      activeBodyEditor = cardEditors[id] ?? null;
    } else {
      activeBodyEditor = null;
    }
  }

  function handlePrimaryBody(md: string) {
    editorState.setMainBody(md);
    onTelemetry?.({ name: 'editor.body_change', detail: { target: 'main' } });
  }
  function handleCardBody(index: number, md: string) {
    editorState.setCardBody(index, md);
    onTelemetry?.({ name: 'editor.body_change', detail: { target: 'card', index } });
  }

  function handleAddCard(insertAt: number) {
    if (cardTypes.length === 0) return;
    if (cardTypes.length === 1) {
      promoteToCard(insertAt, cardTypes[0]!);
      return;
    }
    placeholderInsertAt = insertAt;
  }

  function promoteToCard(insertAt: number, tag: string) {
    const newIdx = editorState.addCard(insertAt, tag, getBlankCardDefaults(editorState, tag));
    if (newIdx < 0) return;
    placeholderInsertAt = null;
    setActive(newIdx);
    onTelemetry?.({ name: 'editor.card_add', detail: { tag, index: newIdx } });
  }

  function handleMoveCard(index: number, dir: 'up' | 'down') {
    const target = dir === 'up' ? index - 1 : index + 1;
    if (!editorState.moveCard(index, target)) return;
    if (activeCardId === index) setActive(target);
    placeholderInsertAt = null;
    onTelemetry?.({ name: 'editor.card_move', detail: { from: index, to: target } });
  }

  function handleDeleteCard(index: number) {
    if (!editorState.removeCard(index)) return;
    if (activeCardId === index) setActive(null);
    placeholderInsertAt = null;
    onTelemetry?.({ name: 'editor.card_delete', detail: { index } });
  }

  function handleCardNameChange(index: number, name: string) {
    const card = editorState.getCard(index);
    const presentation = (card?.frontmatter?.PRESENTATION as Record<string, unknown>) ?? {};
    editorState.setCardField(index, 'PRESENTATION', { ...presentation, name });
  }

  function getCardLabel(index: number): string {
    const card = editorState.getCard(index);
    if (!card) return 'Card';
    const presentation = card.frontmatter?.PRESENTATION as Record<string, unknown> | undefined;
    if (presentation && typeof presentation.name === 'string' && presentation.name) {
      return presentation.name;
    }
    return formatTagLabel(card.tag);
  }

  function formatTagLabel(tag: string): string {
    const clean = tag.replace(/_card$/, '');
    return clean
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  $effect(() => {
    // Reset banner dismissal whenever new diagnostics arrive.
    if (editor.diagnostics.length > 0 || bodyParseFallback) bannerDismissed = false;
  });

  function dismissBanner() {
    bannerDismissed = true;
    bodyParseFallback = null;
  }

  function handleParseFallback(err: unknown) {
    bodyParseFallback = err instanceof Error ? err.message : String(err);
    onParseFallback?.(err);
  }

  function applyTheme(): string {
    if (typeof theme === 'string') return `qme-theme-${theme}`;
    return 'qme-theme-custom';
  }

  export function focus() {
    primary?.focus();
  }

  onDestroy(() => {
    activeBodyEditor = null;
  });
</script>

<div class="qme-root {applyTheme()}" data-active-id={String(activeCardId ?? '')}>
  {#if classification?.banner && classification?.bannerPosition !== 'bottom'}
    <div class="qme-classification" role="note">{classification.banner}</div>
  {/if}

  {#if (editor.diagnostics.length > 0 || bodyParseFallback) && !bannerDismissed}
    <div class="qme-banner" role="alert">
      <div class="qme-banner-body">
        {#if bodyParseFallback}
          <p><strong>Formatting flattened:</strong> body content couldn't be parsed and was loaded as plain text.</p>
        {/if}
        {#each editor.diagnostics as d (d.message)}
          <p><strong class="qme-cap">{d.severity}:</strong> {d.message}</p>
        {/each}
      </div>
      <button type="button" class="qme-banner-close" aria-label="Dismiss" onclick={dismissBanner}>×</button>
    </div>
  {/if}

  <Toolbar getEditor={() => activeBodyEditor?.getEditor() ?? primary?.getEditor() ?? null} features={flags} />

  <div class="qme-scroll">
    <div class="qme-section">
      <EditorBlock
        label="Document"
        variant="primary"
        hideLabel={true}
        isActive={activeCardId === 'main'}
        onclick={() => setActive('main')}
      >
        {#if mainSchema}
          <MetadataWidget state={editorState} schema={mainSchema} target={{ kind: 'main' }} />
        {/if}
        {#if !mainHideBody}
          <BodyEditor
            bind:this={primary}
            content={editor.mainBody}
            placeholder="Start writing…"
            onChange={handlePrimaryBody}
            onParseFallback={handleParseFallback}
            onFocusChange={(f) => {
              if (f) {
                activeBodyEditor = primary ?? null;
                setActive('main');
              }
            }}
          />
        {/if}
      </EditorBlock>

      {#if flags.cards}
        <AddCardTrigger
          onAdd={() => handleAddCard(0)}
          isLast={editor.cards.length === 0 && placeholderInsertAt === null}
          disabled={cardTypes.length === 0}
        />

        {#if placeholderInsertAt === 0}
          <CardTypePicker
            items={cardTypes}
            onSelect={(tag) => promoteToCard(0, tag)}
            onCancel={() => (placeholderInsertAt = null)}
          />
        {/if}

        <div class="qme-cards">
          {#each editor.cards as card, index (index)}
            <div class="qme-card-section">
              <EditorBlock
                label={getCardLabel(index)}
                variant="card"
                isActive={activeCardId === index}
                isFirst={index === 0}
                isLast={index === editor.cards.length - 1}
                onLabelChange={(n) => handleCardNameChange(index, n)}
                onMoveUp={() => handleMoveCard(index, 'up')}
                onMoveDown={() => handleMoveCard(index, 'down')}
                onDelete={() => handleDeleteCard(index)}
                onclick={() => setActive(index)}
              >
                {#if cardSchemaForTag(card.tag)}
                  <MetadataWidget
                    state={editorState}
                    schema={cardSchemaForTag(card.tag)}
                    target={{ kind: 'card', index }}
                  />
                {/if}
                {#if !cardHideBody(card.tag)}
                  <BodyEditor
                    bind:this={cardEditors[index]}
                    content={card.body}
                    placeholder="…"
                    onChange={(md) => handleCardBody(index, md)}
                    onParseFallback={handleParseFallback}
                    onFocusChange={(f) => {
                      if (f) {
                        activeBodyEditor = cardEditors[index] ?? null;
                        setActive(index);
                      }
                    }}
                  />
                {/if}
              </EditorBlock>

              <AddCardTrigger
                onAdd={() => handleAddCard(index + 1)}
                isLast={index === editor.cards.length - 1 && placeholderInsertAt === null}
              />

              {#if placeholderInsertAt === index + 1}
                <CardTypePicker
                  items={cardTypes}
                  onSelect={(tag) => promoteToCard(index + 1, tag)}
                  onCancel={() => (placeholderInsertAt = null)}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="qme-spacer"></div>
    </div>
  </div>

  {#if classification?.banner && classification?.bannerPosition === 'bottom'}
    <div class="qme-classification" role="note">{classification.banner}</div>
  {/if}
</div>

<style>
  .qme-root {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    background: var(--qme-bg, #fff);
    color: var(--qme-text, #0f172a);
    font: inherit;
  }
  .qme-classification {
    text-align: center;
    padding: 0.25rem 0.5rem;
    background: var(--qme-classification-bg, #fef3c7);
    color: var(--qme-classification-text, #78350f);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .qme-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--qme-banner-bg, #fef2f2);
    color: var(--qme-banner-text, #991b1b);
    border-bottom: 1px solid var(--qme-banner-border, #fecaca);
    font-size: 0.875rem;
  }
  .qme-banner-body {
    flex: 1;
    min-width: 0;
  }
  .qme-banner-body p {
    margin: 0;
  }
  .qme-cap {
    text-transform: capitalize;
  }
  .qme-banner-close {
    appearance: none;
    background: transparent;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: 1.25rem;
    line-height: 1;
    padding: 0 0.25rem;
  }
  .qme-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 1rem;
  }
  .qme-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 56rem;
    margin: 0 auto;
  }
  .qme-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .qme-card-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .qme-spacer {
    min-height: 30vh;
  }
</style>
