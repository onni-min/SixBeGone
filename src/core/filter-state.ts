/**
 * Filter state for a MAIN-world interceptor: the current matcher, rebuilt
 * whenever new settings arrive over the bridge.
 *
 * It starts from the built-in rules with filtering on, so pages are filtered
 * from the very first response even before the bridge has delivered the
 * user's settings.
 */
import { compileMatcher, type Matcher } from './matcher';
import { BUILTIN_RULES } from './rules';
import { DEFAULT_SETTINGS, isActive, type Settings } from './settings';
import { onMainMessage, sendToIsolated } from './bridge';

export interface FilterState {
  readonly matcher: Matcher;
  readonly active: boolean;
  /** Report that `count` items were removed (batched to the counter). */
  reportRemoved(count: number): void;
}

export function createFilterState(): FilterState {
  let settings: Settings = DEFAULT_SETTINGS;
  let matcher = build(settings);
  let pending = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  onMainMessage((msg) => {
    if (msg.type === 'settings') {
      settings = msg.settings;
      matcher = build(settings);
    }
  });
  // The isolated script may have started first; ask for settings.
  sendToIsolated({ type: 'hello' });

  return {
    get matcher() {
      return matcher;
    },
    get active() {
      return isActive(settings);
    },
    reportRemoved(count) {
      if (count <= 0) return;
      pending += count;
      timer ??= setTimeout(() => {
        sendToIsolated({ type: 'removed', count: pending });
        pending = 0;
        timer = undefined;
      }, 1000);
    },
  };
}

function build(s: Settings): Matcher {
  return compileMatcher(BUILTIN_RULES, {
    customTerms: s.customTerms,
    allowTerms: s.allowTerms,
    customChannels: s.customChannels,
  });
}
