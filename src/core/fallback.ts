/**
 * Runs a site's page-level fallback in the ISOLATED world: loads settings,
 * rescans on DOM changes (debounced), unhides everything when filtering is
 * off, and resumes by itself when a pause runs out.
 */
import { HIDE_CSS, type Hider } from './hider';
import type { Matcher } from './matcher';
import { buildMatcher } from './rules';
import { isActive, type Settings } from './settings';
import { addRemoved, loadSettings, onSettingsChanged } from './storage';

export interface FallbackHooks {
  /** Called on every scheduled pass, before scanning (even when inactive). */
  beforeScan?: () => void;
  /** Called after settings change, with the new matcher. */
  onSettings?: (settings: Settings, matcher: Matcher) => void;
}

export async function runFallback(
  makeHider: (matcher: Matcher) => Hider,
  hooks: FallbackHooks = {},
): Promise<{ settings: () => Settings; matcher: () => Matcher; schedule: () => void }> {
  const style = document.createElement('style');
  style.textContent = HIDE_CSS;
  (document.head ?? document.documentElement).append(style);

  let settings = await loadSettings();
  let matcher = buildMatcher(settings);
  const hider = makeHider(matcher);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pausedTimer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    timer ??= setTimeout(() => {
      timer = undefined;
      hooks.beforeScan?.();
      if (!isActive(settings)) return;
      const hidden = hider.scan();
      if (hidden > 0) void addRemoved(hidden);
    }, 200);
  };

  const apply = (next: Settings) => {
    settings = next;
    matcher = buildMatcher(next);
    hider.setMatcher(matcher);
    hooks.onSettings?.(next, matcher);
    clearTimeout(pausedTimer);
    if (!isActive(next)) {
      hider.reset();
      const wait = next.enabled ? next.pausedUntil - Date.now() : 0;
      if (wait > 0) pausedTimer = setTimeout(() => apply(settings), wait + 50);
      return;
    }
    schedule();
  };

  onSettingsChanged(apply);
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.addEventListener('popstate', schedule);
  apply(settings);

  return { settings: () => settings, matcher: () => matcher, schedule };
}
