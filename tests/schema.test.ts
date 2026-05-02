import { describe, it, expect } from 'vitest';
import { walkSchema, validateFrontmatter, getQuillSchema, collectDatePaths } from '../src/core/index.js';
import type { FormSchema, Quill } from '../src/core/index.js';

const sampleSchema: FormSchema = {
  fields: {
    title: { name: 'title', type: 'string', required: true },
    priority: { name: 'priority', type: 'integer', default: 0 },
    when: { name: 'when', type: 'date' },
    flag: { name: 'flag', type: 'boolean' },
    nested: {
      name: 'nested',
      type: 'object',
      fields: {
        deep_when: { name: 'deep_when', type: 'date' },
      },
    },
    items: {
      name: 'items',
      type: 'array',
      items: {
        type: 'object',
        fields: { ts: { name: 'ts', type: 'date' } },
      },
    },
    color: { name: 'color', type: 'string', enum: ['red', 'blue'] },
  },
};

describe('walkSchema', () => {
  it('visits each field with a dotted path', () => {
    const visited: string[] = [];
    walkSchema(sampleSchema, ({ path }) => visited.push(path));
    expect(visited).toContain('title');
    expect(visited).toContain('nested');
    expect(visited).toContain('nested.deep_when');
    expect(visited).toContain('items');
    expect(visited).toContain('items.*.ts');
  });

  it('is a no-op on null / empty schemas', () => {
    const visited: string[] = [];
    walkSchema(null, ({ path }) => visited.push(path));
    walkSchema(undefined, ({ path }) => visited.push(path));
    walkSchema({ fields: {} }, ({ path }) => visited.push(path));
    expect(visited).toEqual([]);
  });
});

describe('validateFrontmatter', () => {
  it('flags missing required fields', () => {
    const issues = validateFrontmatter({ priority: 1 }, sampleSchema);
    expect(issues.find((i) => i.path === 'title')).toBeDefined();
  });

  it('flags wrong types', () => {
    const issues = validateFrontmatter({ title: 'ok', priority: 'oops' }, sampleSchema);
    expect(issues.find((i) => i.path === 'priority')).toBeDefined();
  });

  it('flags enum mismatches', () => {
    const issues = validateFrontmatter({ title: 'ok', color: 'green' }, sampleSchema);
    expect(issues.find((i) => i.path === 'color')).toBeDefined();
  });

  it('passes when everything is valid', () => {
    const issues = validateFrontmatter(
      { title: 'ok', priority: 1, color: 'red', flag: true },
      sampleSchema,
    );
    expect(issues).toEqual([]);
  });
});

describe('schema introspection over a Quill', () => {
  const fakeQuill = {
    metadata: {
      schema: {
        name: 'sample',
        main: sampleSchema,
        card_types: {
          note: {
            fields: {
              recorded_on: { name: 'recorded_on', type: 'date' },
            },
          } as FormSchema,
        },
      },
    },
  } as unknown as Quill;

  it('reads main + cardTypes off the metadata', () => {
    const { main, cardTypes } = getQuillSchema(fakeQuill)!;
    expect(main).toBe(sampleSchema);
    expect(cardTypes?.note).toBeDefined();
  });

  it('collects every date path (including nested + array entries)', () => {
    const paths = collectDatePaths(fakeQuill);
    expect(paths.frontmatter).toEqual(expect.arrayContaining(['when', 'nested.deep_when', 'items.*.ts']));
    expect(paths.cards.get('note')).toEqual(['recorded_on']);
  });
});
