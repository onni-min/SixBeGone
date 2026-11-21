import { describe, expect, it } from 'vitest';
import { compileMatcher } from '../src/core/matcher';
import { BUILTIN_RULES } from '../src/core/rules';

const m = compileMatcher(BUILTIN_RULES);

describe('built-in rules: removed', () => {
  it.each([
    'GTA 6 Trailer 3 Breakdown',
    'I played GTA6 for 24 hours straight',
    'GTA VI - Every Secret in the Map',
    '#gta6 #gaming',
    'Grand Theft Auto VI review',
    'Grand Theft Auto 6 ending explained (SPOILERS)',
    'gta six is finally here',
    'G.T.A. 6 story mission walkthrough',
    'ГТА 6 обзор',
    'Lucia Caminos voice actor interview',
    'Jason Duval is the best protagonist',
    'Leonida map size compared to Los Santos GTA',
    'Exploring all of Leonida and Vice City', // two weak terms
    'Jason and Lucia full romance GTA', // weak + gta
    'Port Gellhorn is wild – GTA',
  ])('%s', (title) => {
    expect(m.match(title).blocked).toBe(true);
  });
});

describe('built-in rules: kept (GTA 6 only scope)', () => {
  it.each([
    'GTA 5 Online new update',
    'GTA V speedrun world record',
    'GTA Vice City Definitive Edition review',
    'Grand Theft Auto: San Andreas 20 years later',
    'GTA 4 multiplayer is still alive',
    'Rockstar Games Red Dead Redemption 2',
    'Vice City Miami travel vlog',
    'Jason and Lucia wedding highlights',
    'Learning vi keybindings',
    'Top 6 open world games',
    'Leonida', // weak alone (6 < 10)
    'GTA 61st anniversary', // not "6"
    '',
  ])('%s', (title) => {
    expect(m.match(title).blocked).toBe(false);
  });
});

describe('scoring', () => {
  it('reports the phrases that matched', () => {
    const r = m.match('Leonida in GTA');
    expect(r.blocked).toBe(true);
    expect(r.hits.sort()).toEqual(['gta', 'leonida']);
    expect(r.score).toBe(10);
  });

  it('counts each phrase once', () => {
    expect(m.match('gta gta gta gta').score).toBe(4);
  });

  it('combines fields of one item', () => {
    // Title alone is weak; the channel name adds the rest.
    expect(m.match('Leonida map tour', 'Vice City Fan Channel').blocked).toBe(true);
  });

  it('does not match a phrase across two fields', () => {
    expect(m.match('Best moments in GTA', '6 friends play').hits).not.toContain('gta 6');
  });

  it('ignores empty and missing fields', () => {
    expect(m.match(undefined, null, '', 'GTA 6').blocked).toBe(true);
  });
});

describe('user options', () => {
  it('custom terms block on their own', () => {
    const c = compileMatcher(BUILTIN_RULES, { customTerms: ['Vinewood Spoilers'] });
    expect(c.match('vinewood spoilers inside').blocked).toBe(true);
    expect(c.match('Vinewood').blocked).toBe(false);
  });

  it('allow terms keep a matching post visible', () => {
    const c = compileMatcher(BUILTIN_RULES, { allowTerms: ['patch notes'] });
    expect(c.match('GTA 6 patch notes 1.02').blocked).toBe(false);
    expect(c.match('GTA 6 ending').blocked).toBe(true);
  });

  it('blank user entries are ignored', () => {
    const c = compileMatcher(BUILTIN_RULES, { customTerms: ['', '   '], allowTerms: ['  '] });
    expect(c.match('nothing here').blocked).toBe(false);
    expect(c.match('GTA 6').blocked).toBe(true);
  });

  it('channel block list matches handles and ids case-insensitively', () => {
    const c = compileMatcher(BUILTIN_RULES, { customChannels: ['@SomeGTA6Channel', 'UCabc123'] });
    expect(c.isBlockedChannel('somegta6channel')).toBe(true);
    expect(c.isBlockedChannel('@SOMEGTA6CHANNEL')).toBe(true);
    expect(c.isBlockedChannel('ucabc123')).toBe(true);
    expect(c.isBlockedChannel('other')).toBe(false);
    expect(c.isBlockedChannel(undefined)).toBe(false);
  });
});
