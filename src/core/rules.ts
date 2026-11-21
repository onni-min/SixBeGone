import builtin from '../rules/gta6.json';
import strict from '../rules/strict.json';
import { compileMatcher, type Matcher, type Rules } from './matcher';
import type { Settings } from './settings';

/** The rules bundled with the extension. Shipped as data, never code. */
export const BUILTIN_RULES: Rules = {
  version: builtin.version,
  threshold: builtin.threshold,
  terms: builtin.terms,
  channels: builtin.channels,
};

/** Built-in rules plus the strict-mode list (all GTA and Rockstar). */
export const STRICT_RULES: Rules = {
  version: strict.version,
  threshold: builtin.threshold,
  // compileMatcher keeps the highest weight when a phrase appears twice, so
  // strict "gta" (10) overrides the GTA 6 list's weak "gta" (4).
  terms: [...builtin.terms, ...strict.terms],
  channels: [...builtin.channels, ...strict.channels],
};

/** The matcher for the user's current settings. */
export function buildMatcher(s: Settings): Matcher {
  return compileMatcher(s.strict ? STRICT_RULES : BUILTIN_RULES, {
    customTerms: s.customTerms,
    allowTerms: s.allowTerms,
    customChannels: s.customChannels,
  });
}
