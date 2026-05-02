import { describe, it, expect } from 'vitest';
import { TRANSFORMERS } from '@lexical/markdown';
import { buildTransformers, UNDERLINE_UNDERSCORE } from '../src/core/index.js';

describe('buildTransformers', () => {
  it('includes UNDERLINE_UNDERSCORE in place of the default BOLD_UNDERSCORE', () => {
    const out = buildTransformers();
    const underscoreFormatters = out.filter(
      (t) => t.type === 'text-format' && (t as { tag?: string }).tag === '__',
    );
    expect(underscoreFormatters.length).toBe(1);
    expect(underscoreFormatters[0]).toBe(UNDERLINE_UNDERSCORE);
    expect((underscoreFormatters[0] as { format?: string[] }).format).toContain('underline');
  });

  it('keeps every non-conflicting transformer from `TRANSFORMERS`', () => {
    const out = buildTransformers();
    // Same length: we substitute one transformer, never add or drop.
    expect(out.length).toBe(TRANSFORMERS.length);
  });
});
