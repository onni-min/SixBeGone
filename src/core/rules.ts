import builtin from '../rules/gta6.json';
import type { Rules } from './matcher';

/** The rules bundled with the extension. Shipped as data, never code. */
export const BUILTIN_RULES: Rules = {
  version: builtin.version,
  threshold: builtin.threshold,
  terms: builtin.terms,
  channels: builtin.channels,
};
