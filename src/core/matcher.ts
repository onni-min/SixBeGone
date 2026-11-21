import { normalize } from './normalize';

export interface RuleTerm {
  phrase: string;
  weight: number;
}

export interface Rules {
  version: number;
  threshold: number;
  terms: RuleTerm[];
  /** Channel / account identifiers (ids or handles) that are always removed. */
  channels: string[];
}

export interface MatcherOptions {
  /** User keywords. Each one removes a post on its own. */
  customTerms?: string[];
  /** User phrases that keep a post visible even when it matches. */
  allowTerms?: string[];
  /** Extra channels/accounts to always remove. */
  customChannels?: string[];
}

export interface MatchResult {
  blocked: boolean;
  score: number;
  /** The rule phrases that matched, as written in the rules (for the "why" log). */
  hits: string[];
}

export interface Matcher {
  /** Score one or more text fields of a single item (title, channel, description…). */
  match(...fields: Array<string | null | undefined>): MatchResult;
  /** True if the channel id/handle is on a block list. */
  isBlockedChannel(channel: string | null | undefined): boolean;
}

interface CompiledTerm {
  needle: string;
  phrase: string;
  weight: number;
}

// Fields are joined with a separator that normalize() can never produce, so a
// phrase can't straddle two fields ("…GTA" + "6 tips…").
const FIELD_JOIN = '|';

export function compileMatcher(rules: Rules, options: MatcherOptions = {}): Matcher {
  const threshold = rules.threshold;
  const byNeedle = new Map<string, CompiledTerm>();

  const add = (phrase: string, weight: number) => {
    const needle = normalize(phrase);
    if (needle.trim() === '') return;
    const existing = byNeedle.get(needle);
    if (!existing || existing.weight < weight) byNeedle.set(needle, { needle, phrase, weight });
  };

  for (const t of rules.terms) add(t.phrase, t.weight);
  for (const t of options.customTerms ?? []) add(t, threshold);

  const terms = [...byNeedle.values()];
  const allow = (options.allowTerms ?? []).map(normalize).filter((n) => n.trim() !== '');
  const channels = new Set(
    [...rules.channels, ...(options.customChannels ?? [])].map(normalizeChannel).filter(Boolean),
  );

  return {
    match(...fields) {
      const haystack = fields
        .filter((f): f is string => typeof f === 'string' && f.length > 0)
        .map(normalize)
        .join(FIELD_JOIN);

      if (allow.some((a) => haystack.includes(a))) {
        return { blocked: false, score: 0, hits: [] };
      }

      let score = 0;
      const hits: string[] = [];
      for (const term of terms) {
        if (haystack.includes(term.needle)) {
          score += term.weight;
          hits.push(term.phrase);
        }
      }
      return { blocked: score >= threshold, score, hits };
    },

    isBlockedChannel(channel) {
      if (!channel) return false;
      return channels.has(normalizeChannel(channel));
    },
  };
}

function normalizeChannel(c: string): string {
  return c.trim().toLowerCase().replace(/^@/, '');
}
