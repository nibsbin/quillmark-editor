import { describe, it, expect, vi } from 'vitest';
import { createEditorState, isEmptyValue } from '../src/core/index.js';
import { createFakeQuillmarkHost, SAMPLE_MARKDOWN } from './fakes/fake-quillmark-host.js';

describe('createEditorState', () => {
  it('starts uninitialized', () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    expect(state.isInitialized).toBe(false);
    expect(state.version).toBe(0);
    expect(state.cards).toEqual([]);
    expect(state.toMarkdown()).toBe('');
  });

  it('loads markdown asynchronously and exposes the parsed shape', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await state.load(SAMPLE_MARKDOWN);
    expect(state.isInitialized).toBe(true);
    expect(state.quillRef).toBe('usaf_memo@0.2.0');
    expect(state.mainFrontmatter.title).toBe('My Document');
    expect(state.mainBody).toBe('This is the body.');
    expect(state.cards.length).toBe(1);
    expect(state.cards[0]?.tag).toBe('note_card');
  });

  it('round-trips: load → toMarkdown → load reaches structural equality', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await state.load(SAMPLE_MARKDOWN);
    const v1 = state.version;
    const md = state.toMarkdown();

    // Re-loading the same canonical markdown must NOT bump the version
    // (this is the echo-suppression contract — preview/save loops depend on it).
    await state.load(md);
    expect(state.version).toBe(v1);
  });

  it('bumps version on body mutation and notifies subscribers', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await state.load(SAMPLE_MARKDOWN);

    const cb = vi.fn();
    const off = state.subscribe(cb);
    const before = state.version;
    state.setMainBody('New body');
    expect(state.version).toBe(before + 1);
    expect(cb).toHaveBeenCalledWith(before + 1);
    expect(state.mainBody).toBe('New body');
    off();
    state.setMainBody('Another');
    expect(cb).toHaveBeenCalledTimes(1); // unsubscribed
  });

  it('manages cards: add, move, remove, set fields, set tag', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await state.load(SAMPLE_MARKDOWN);

    const newIdx = state.addCard(1, 'note_card', { priority: 5 });
    expect(newIdx).toBe(1);
    expect(state.cards.length).toBe(2);
    expect(state.cards[1]?.frontmatter.priority).toBe(5);

    expect(state.moveCard(0, 1)).toBe(true);
    expect(state.cards[0]?.frontmatter.priority).toBe(5);

    state.setCardField(0, 'priority', 9, 'integer');
    expect(state.cards[0]?.frontmatter.priority).toBe(9);

    state.setCardTag(0, 'note_card');
    expect(state.cards[0]?.tag).toBe('note_card');

    expect(state.removeCard(1)).toBe(true);
    expect(state.cards.length).toBe(1);
  });

  it('drops stale card index writes silently', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await state.load(SAMPLE_MARKDOWN);
    const v = state.version;
    state.setCardBody(99, 'should be ignored');
    expect(state.version).toBe(v);
  });

  it('removes empty fields rather than writing empty strings (per contract)', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await state.load(SAMPLE_MARKDOWN);
    state.setMainField('title', '   ', 'string');
    expect('title' in state.mainFrontmatter).toBe(false);
    state.setMainField('count', 0, 'number');
    expect(state.mainFrontmatter.count).toBe(0);
  });

  it('supports throwing → diagnostics on parse failure', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await expect(state.load('')).rejects.toThrow();
    expect(state.diagnostics.length).toBeGreaterThan(0);
  });

  it('detects markdown-string equality with the loaded document', async () => {
    const state = createEditorState({ quillmark: createFakeQuillmarkHost() });
    await state.load(SAMPLE_MARKDOWN);
    expect(state.equalsMarkdown(state.toMarkdown())).toBe(true);
    expect(state.equalsMarkdown(SAMPLE_MARKDOWN.replace('My Document', 'Other'))).toBe(false);
  });
});

describe('isEmptyValue', () => {
  it('handles each schema type', () => {
    expect(isEmptyValue('  ', 'string')).toBe(true);
    expect(isEmptyValue('a', 'string')).toBe(false);
    expect(isEmptyValue([], 'array')).toBe(true);
    expect(isEmptyValue([1], 'array')).toBe(false);
    expect(isEmptyValue(null, 'number')).toBe(true);
    expect(isEmptyValue(0, 'number')).toBe(false);
    expect(isEmptyValue(false, 'boolean')).toBe(false);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue('')).toBe(false);
  });
});
