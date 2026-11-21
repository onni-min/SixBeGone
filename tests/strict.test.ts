import { describe, expect, it } from 'vitest';
import { normalize } from '../src/core/normalize';
import { buildMatcher, STRICT_RULES } from '../src/core/rules';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import strictJson from '../src/rules/strict.json';

const normal = buildMatcher(DEFAULT_SETTINGS);
const strict = buildMatcher({ ...DEFAULT_SETTINGS, strict: true });

describe('strict mode', () => {
  it.each([
    'GTA 5 Online new heist',
    'GTA V speedrun world record',
    'GTA Vice City Definitive Edition review',
    'Grand Theft Auto: San Andreas 20 years later',
    'GTA IV multiplayer is still alive',
    'Best FiveM roleplay servers',
    'Red Dead Redemption 2 hidden details',
    'RDR2 legendary animals',
    'Rockstar Games announces new title',
    'Max Payne 3 still holds up',
    'L.A. Noire remaster',
    'Red Dead and Rockstar at their best',
    'GTA 6 Trailer 3', // still covered
  ])('removes: %s', (title) => {
    expect(strict.match(title).blocked).toBe(true);
  });

  it.each([
    'Rockstar energy drink review',
    'Living like a rockstar on tour',
    'Red dead plants in my garden',
    'Anti-bully campaign at school',
    'Cooking pasta',
  ])('keeps: %s', (title) => {
    expect(strict.match(title).blocked).toBe(false);
  });

  it('normal mode still lets GTA 5 and Rockstar through', () => {
    expect(normal.match('GTA 5 Online new heist').blocked).toBe(false);
    expect(normal.match('Red Dead Redemption 2 hidden details').blocked).toBe(false);
    expect(normal.match('Rockstar Games announces new title').blocked).toBe(false);
  });

  it("blocks Rockstar's own channel", () => {
    expect(strict.isBlockedChannel('@RockstarGames')).toBe(true);
    expect(normal.isBlockedChannel('@RockstarGames')).toBe(false);
  });

  it('allow phrases still win', () => {
    const m = buildMatcher({ ...DEFAULT_SETTINGS, strict: true, allowTerms: ['red dead redemption'] });
    expect(m.match('Red Dead Redemption 2 hidden details').blocked).toBe(false);
  });

  it('strict list has no duplicates within itself', () => {
    const strictOnly = strictJson.terms.map((t) => normalize(t.phrase));
    expect(STRICT_RULES.terms.length).toBeGreaterThan(strictOnly.length);
    expect(new Set(strictOnly).size).toBe(strictOnly.length);
  });
});
