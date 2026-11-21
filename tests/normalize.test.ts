import { describe, expect, it } from 'vitest';
import { normalize } from '../src/core/normalize';

describe('normalize', () => {
  it.each([
    ['GTA 6', ' gta 6 '],
    ['gta6', ' gta 6 '],
    ['#GTA6', ' gta 6 '],
    ['#GTA6Leaks', ' gta 6 leaks '],
    ['GTA-VI', ' gta vi '],
    ['GTA:VI', ' gta vi '],
    ['GTAVI', ' gta vi '],
    ['G.T.A. 6', ' gta 6 '],
    ['G T A VI', ' gta vi '],
    ['ＧＴＡ６', ' gta 6 '], // full-width
    ['gta​6', ' gta 6 '], // zero-width space
    ['g­ta 6', ' gta 6 '], // soft hyphen
    ['GTA 6 🔥🔥', ' gta 6 '],
    ['Grand Theft Auto VI', ' grand theft auto vi '],
    ['GrandTheftAutoVI', ' grand theft auto vi '],
    ['Lucía Caminos', ' lucia caminos '], // accent stripped
    ['ГТА 6', ' гта 6 '],
    ['', ' '],
    ['!!!', ' '],
  ])('%j -> %j', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  it('keeps digits as separate tokens', () => {
    expect(normalize('GTA 61')).toBe(' gta 61 ');
    expect(normalize('2026')).toBe(' 2026 ');
  });
});
