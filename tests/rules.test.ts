import { describe, expect, it } from 'vitest';
import { BUILTIN_RULES } from '../src/core/rules';
import { normalize } from '../src/core/normalize';
import { parseLines, withDefaults, DEFAULT_SETTINGS } from '../src/core/settings';

describe('built-in rules file', () => {
  it('has a positive threshold and weights', () => {
    expect(BUILTIN_RULES.threshold).toBeGreaterThan(0);
    for (const t of BUILTIN_RULES.terms) expect(t.weight).toBeGreaterThan(0);
  });

  it('has no duplicate phrases after normalization', () => {
    const seen = new Set<string>();
    for (const t of BUILTIN_RULES.terms) {
      const n = normalize(t.phrase);
      expect(seen.has(n), `duplicate: ${t.phrase}`).toBe(false);
      seen.add(n);
    }
  });

  it('never lets a GTA-series word block on its own (GTA 6 only scope)', () => {
    for (const phrase of ['gta', 'grand theft auto', 'vice city']) {
      const term = BUILTIN_RULES.terms.find((t) => t.phrase === phrase);
      expect(term?.weight).toBeLessThan(BUILTIN_RULES.threshold);
    }
  });
});

describe('settings helpers', () => {
  it('fills in defaults from partial or junk storage', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults({ enabled: false, customTerms: ['a', 3] })).toEqual({
      ...DEFAULT_SETTINGS,
      enabled: false,
      customTerms: ['a'],
    });
  });

  it('parses one phrase per line', () => {
    expect(parseLines(' a \n\nb\na\n')).toEqual(['a', 'b']);
  });
});
