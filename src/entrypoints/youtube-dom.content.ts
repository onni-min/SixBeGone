import { onIsolatedMessage, type ToIsolated } from '../core/bridge';
import { runFallback } from '../core/fallback';
import { isActive } from '../core/settings';
import { YOUTUBE_MATCHES } from '../core/sites';
import { addRemoved } from '../core/storage';
import { createScanner } from '../sites/youtube/dom';
import { createGuard, type Guard } from '../sites/youtube/guard';

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

    let guard: Guard | undefined;
    const fb = await runFallback((matcher) => createScanner(document, matcher), {
      beforeScan: () => guard?.check(),
      onSettings: () => guard?.reset(),
    });

    guard = createGuard({
      doc: document,
      matcher: fb.matcher,
      active: () => isActive(fb.settings()),
      onRemoved: (n) => void addRemoved(n),
    });
    document.addEventListener('yt-navigate-finish', fb.schedule);

    onVideo = (m) => guard!.verdict(m.kind, m.videoId, m.blocked);
    early.splice(0).forEach(onVideo);
    guard.check();
  },
});
