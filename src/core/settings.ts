/** User settings, stored in browser.storage.local under SETTINGS_KEY. */
export interface Settings {
  enabled: boolean;
  /** Also block all GTA games and everything Rockstar Games, not only GTA 6. */
  strict: boolean;
  /** Epoch ms. Filtering is off until then; 0 means not paused. */
  pausedUntil: number;
  customTerms: string[];
  allowTerms: string[];
  customChannels: string[];
}

export const SETTINGS_KEY = 'settings';
export const STATS_KEY = 'stats';

export interface Stats {
  removedTotal: number;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  strict: false,
  pausedUntil: 0,
  customTerms: [],
  allowTerms: [],
  customChannels: [],
};

export function isActive(s: Settings, now = Date.now()): boolean {
  return s.enabled && s.pausedUntil <= now;
}

/** Fill in missing fields from an older or partial stored object. */
export function withDefaults(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Settings>;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SETTINGS.enabled,
    strict: s.strict === true,
    pausedUntil: typeof s.pausedUntil === 'number' ? s.pausedUntil : 0,
    customTerms: list(s.customTerms),
    allowTerms: list(s.allowTerms),
    customChannels: list(s.customChannels),
  };
}

/** One phrase per line; blank lines and duplicates dropped. */
export function parseLines(text: string): string[] {
  return [...new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))];
}
