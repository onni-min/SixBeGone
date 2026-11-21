import { onIsolatedMessage, type ToIsolated } from '../core/bridge';
import { buildMatcher } from '../core/rules';
import { isActive, type Settings } from '../core/settings';
import { YOUTUBE_MATCHES } from '../core/sites';
import { addRemoved, loadSettings, onSettingsChanged } from '../core/storage';
import { createScanner, HIDE_CSS } from '../sites/youtube/dom';
import { createGuard } from '../sites/youtube/guard';

// ISOLATED world, YouTube only:
//   - hides GTA 6 cards the network layer missed
//   - covers GTA 6 watch pages and skips GTA 6 Shorts
export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  runAt: 'document_start',
  async main() {
    // Verdicts can arrive while settings are still loading (the first page's
    // data is parsed early), so buffer them until the guard exists.
    type VideoMsg = Extract<ToIsolated, { type: 'video' }>;
    const early: VideoMsg[] = [];
    let onVideo: (m: VideoMsg) => void = (m) => void early.push(m);
    onIsolatedMessage((m) => {
      if (m.type === 'video') onVideo(m);
    });

    const style = document.createElement('style');
    style.textContent = HIDE_CSS;
    (document.head ?? document.documentElement).append(style);

    const build = buildMatcher;

    let settings = await loadSettings();
    let matcher = build(settings);
    const scanner = createScanner(document, matcher);
    const guard = createGuard({
      doc: document,
      matcher: () => matcher,
      active: () => isActive(settings),
      onRemoved: (n) => void addRemoved(n),
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pausedTimer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer ??= setTimeout(() => {
        timer = undefined;
        guard.check();
        if (!isActive(settings)) return;
        const hidden = scanner.scan();
        if (hidden > 0) void addRemoved(hidden);
      }, 200);
    };

    const apply = (next: Settings) => {
      settings = next;
      matcher = build(next);
      scanner.setMatcher(matcher);
      guard.reset();
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
    window.addEventListener('popstate', schedule);
    apply(settings);

    // After apply(): it resets the guard, which would drop these.
    onVideo = (m) => guard.verdict(m.kind, m.videoId, m.blocked);
    early.splice(0).forEach(onVideo);
  },
});
