import { compileMatcher } from '../core/matcher';
import { BUILTIN_RULES } from '../core/rules';
import { isActive, type Settings } from '../core/settings';
import { YOUTUBE_MATCHES } from '../core/sites';
import { addRemoved, loadSettings, onSettingsChanged } from '../core/storage';
import { createScanner, HIDE_CSS } from '../sites/youtube/dom';

// ISOLATED world fallback: hides GTA 6 cards the network layer missed.
export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  runAt: 'document_start',
  async main() {
    const style = document.createElement('style');
    style.textContent = HIDE_CSS;
    (document.head ?? document.documentElement).append(style);

    const build = (s: Settings) =>
      compileMatcher(BUILTIN_RULES, {
        customTerms: s.customTerms,
        allowTerms: s.allowTerms,
        customChannels: s.customChannels,
      });

    let settings = await loadSettings();
    const scanner = createScanner(document, build(settings));

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pausedTimer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer ??= setTimeout(() => {
        timer = undefined;
        if (!isActive(settings)) return;
        const hidden = scanner.scan();
        if (hidden > 0) void addRemoved(hidden);
      }, 200);
    };

    const apply = (next: Settings) => {
      settings = next;
      scanner.setMatcher(build(next));
      clearTimeout(pausedTimer);
      if (!isActive(next)) {
        scanner.reset();
        // Resume on our own when a pause runs out.
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
    document.addEventListener('yt-navigate-finish', schedule);
    apply(settings);
  },
});
