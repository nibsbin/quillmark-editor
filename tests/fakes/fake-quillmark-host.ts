/**
 * Test fake for `QuillmarkHost`. Implements the slice of `@quillmark/wasm`
 * the editor depends on, in pure TypeScript, so core tests run without
 * loading a real wasm binary.
 *
 * The fake is shaped exactly like wasm 0.66's `Document` API surface that
 * `EditorState` calls into (`fromMarkdown`, `equals`, `toMarkdown`,
 * `replaceBody`, `setField`, `removeField`, card mutation methods, etc.).
 */

import type {
  Card,
  Diagnostic,
  Document,
  Quill,
  QuillmarkHost,
} from '../../src/core/types.js';

interface ParsedDoc {
  quillRef: string;
  mainFrontmatter: Record<string, unknown>;
  mainBody: string;
  cards: Array<{
    tag: string;
    frontmatter: Record<string, unknown>;
    body: string;
  }>;
}

const FRONT_RE = /^---\n([\s\S]*?)\n---\n?/;

function parseYamlSubset(text: string): Record<string, unknown> {
  // A *very* small YAML reader for tests: scalar k/v pairs only.
  const out: Record<string, unknown> = {};
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, k, raw] = m;
    out[k!] = parseScalar(raw!);
  }
  return out;
}

function parseScalar(raw: string): unknown {
  if (raw === '' || raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  return raw;
}

function emitYaml(record: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(record)) {
    parts.push(`${k}: ${emitScalar(v)}`);
  }
  return parts.join('\n');
}

function emitScalar(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function parseMarkdownToDoc(src: string): ParsedDoc {
  const doc: ParsedDoc = {
    quillRef: '',
    mainFrontmatter: {},
    mainBody: '',
    cards: [],
  };
  // Split on `\n---\n` boundaries that introduce a `--card` style separator.
  // For test purposes we just look for `\n# CARD <tag>` markers as cards.
  const fm = FRONT_RE.exec(src);
  let rest = src;
  if (fm) {
    doc.mainFrontmatter = parseYamlSubset(fm[1]!);
    rest = src.slice(fm[0].length);
    if (typeof doc.mainFrontmatter.QUILL === 'string') {
      doc.quillRef = doc.mainFrontmatter.QUILL;
    }
  }
  const cardRe = /\n# CARD (\S+)\n/g;
  let cardMatch: RegExpExecArray | null;
  let cursor = 0;
  const cardSplits: Array<{ tag: string; start: number }> = [];
  while ((cardMatch = cardRe.exec(rest)) !== null) {
    cardSplits.push({ tag: cardMatch[1]!, start: cardMatch.index });
  }
  if (cardSplits.length === 0) {
    doc.mainBody = rest.replace(/^\n+/, '').replace(/\s+$/, '');
    return doc;
  }
  doc.mainBody = rest.slice(0, cardSplits[0]!.start).replace(/^\n+/, '').replace(/\s+$/, '');
  for (let i = 0; i < cardSplits.length; i++) {
    const s = cardSplits[i]!;
    const next = cardSplits[i + 1];
    const cardSrc = rest.slice(s.start + `\n# CARD ${s.tag}\n`.length, next?.start ?? rest.length);
    const cfm = FRONT_RE.exec(cardSrc);
    let cardFm: Record<string, unknown> = {};
    let cardBody = cardSrc;
    if (cfm) {
      cardFm = parseYamlSubset(cfm[1]!);
      cardBody = cardSrc.slice(cfm[0].length);
    }
    doc.cards.push({
      tag: s.tag,
      frontmatter: cardFm,
      body: cardBody.replace(/^\n+/, '').replace(/\s+$/, ''),
    });
    cursor = next?.start ?? rest.length;
  }
  void cursor;
  return doc;
}

function emitMarkdownFromDoc(doc: ParsedDoc): string {
  const parts: string[] = [];
  parts.push('---');
  const front = { QUILL: doc.quillRef, ...doc.mainFrontmatter };
  if (!doc.quillRef) delete (front as Record<string, unknown>).QUILL;
  parts.push(emitYaml(front));
  parts.push('---');
  if (doc.mainBody) parts.push('\n' + doc.mainBody);
  for (const card of doc.cards) {
    parts.push(`\n# CARD ${card.tag}`);
    parts.push('---');
    parts.push(emitYaml(card.frontmatter));
    parts.push('---');
    if (card.body) parts.push('\n' + card.body);
  }
  return parts.join('\n');
}

class FakeDocument {
  // Internal mutable shape; the wasm Document keeps state on the wasm side
  // but the *behavior* is what we exercise.
  private state: ParsedDoc;
  freed = false;

  constructor(state: ParsedDoc) {
    this.state = state;
  }

  static fromMarkdown(markdown: string): FakeDocument {
    if (!markdown.trim()) {
      const err = new Error('Empty document') as Error & { diagnostics?: Diagnostic[] };
      err.diagnostics = [
        { severity: 'error', message: 'Empty document', sourceChain: [] } as unknown as Diagnostic,
      ];
      throw err;
    }
    return new FakeDocument(parseMarkdownToDoc(markdown));
  }

  get quillRef(): string {
    return this.state.quillRef;
  }
  setQuillRef(ref: string): void {
    this.state.quillRef = ref;
  }
  get main(): Card {
    return {
      sentinel: '',
      tag: '',
      frontmatter: this.state.mainFrontmatter,
      frontmatterItems: [],
      body: this.state.mainBody,
    } as unknown as Card;
  }
  get cards(): Card[] {
    return this.state.cards.map((c) => ({
      sentinel: '',
      tag: c.tag,
      frontmatter: c.frontmatter,
      frontmatterItems: [],
      body: c.body,
    })) as unknown as Card[];
  }
  get cardCount(): number {
    return this.state.cards.length;
  }
  get warnings(): Diagnostic[] {
    return [];
  }
  toMarkdown(): string {
    return emitMarkdownFromDoc(this.state);
  }
  equals(other: FakeDocument): boolean {
    return this.toMarkdown() === other.toMarkdown();
  }
  replaceBody(body: string): void {
    this.state.mainBody = body;
  }
  updateCardBody(index: number, body: string): void {
    this.state.cards[index]!.body = body;
  }
  setField(name: string, value: unknown): void {
    this.state.mainFrontmatter[name] = value;
  }
  removeField(name: string): unknown {
    const v = this.state.mainFrontmatter[name];
    delete this.state.mainFrontmatter[name];
    return v;
  }
  updateCardField(index: number, name: string, value: unknown): void {
    this.state.cards[index]!.frontmatter[name] = value;
  }
  removeCardField(index: number, name: string): unknown {
    const v = this.state.cards[index]?.frontmatter[name];
    if (this.state.cards[index]) delete this.state.cards[index]!.frontmatter[name];
    return v;
  }
  insertCard(index: number, card: { tag: string; fields: Record<string, unknown>; body: string }): void {
    this.state.cards.splice(index, 0, {
      tag: card.tag,
      frontmatter: card.fields,
      body: card.body,
    });
  }
  removeCard(index: number): Card | undefined {
    if (index < 0 || index >= this.state.cards.length) return undefined;
    const [removed] = this.state.cards.splice(index, 1);
    return {
      sentinel: '',
      tag: removed!.tag,
      frontmatter: removed!.frontmatter,
      frontmatterItems: [],
      body: removed!.body,
    } as unknown as Card;
  }
  moveCard(from: number, to: number): void {
    const [c] = this.state.cards.splice(from, 1);
    this.state.cards.splice(to, 0, c!);
  }
  setCardTag(index: number, newTag: string): void {
    this.state.cards[index]!.tag = newTag;
  }
  free(): void {
    this.freed = true;
  }
}

class FakeQuill {
  metadata: {
    schema: {
      name?: string;
      main?: { fields: Record<string, unknown> };
      card_types?: Record<string, { fields: Record<string, unknown> }>;
    };
    supportedFormats: string[];
  };

  constructor(name: string) {
    this.metadata = {
      schema: {
        name,
        main: {
          fields: {
            title: { name: 'title', type: 'string', title: 'Title' },
            author: { name: 'author', type: 'string', title: 'Author' },
          },
        },
        card_types: {
          note_card: {
            fields: {
              priority: { name: 'priority', type: 'integer', default: 0 },
              tags: { name: 'tags', type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      supportedFormats: ['pdf', 'svg'],
    };
  }

  blankCard(tag: string): { values: Record<string, { source: string; default: unknown }> } | null {
    if (tag === 'note_card') {
      return {
        values: {
          priority: { source: 'default', default: 0 },
          tags: { source: 'missing', default: undefined },
        },
      };
    }
    return null;
  }
}

export function createFakeQuillmarkHost(): QuillmarkHost {
  const quills = new Map<string, FakeQuill>();
  return {
    isReady: () => true,
    Document: FakeDocument as unknown as QuillmarkHost['Document'],
    getQuill: (ref: string) => {
      let q = quills.get(ref);
      if (!q) {
        q = new FakeQuill(ref);
        quills.set(ref, q);
      }
      return q as unknown as Quill;
    },
    ensureQuillResolved: async (ref: string) => {
      if (!quills.has(ref)) quills.set(ref, new FakeQuill(ref));
    },
  };
}

export const SAMPLE_MARKDOWN = `---
QUILL: usaf_memo@0.2.0
title: My Document
author: Test Author
---

This is the body.

# CARD note_card
---
priority: 1
---

Card body content.
`;
