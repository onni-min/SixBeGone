import { sendToIsolated } from '../../core/bridge';
import type { FilterState } from '../../core/filter-state';
import type { Matcher } from '../../core/matcher';
import { trapGlobal, wrapFetch, wrapXhr, type Pruner } from '../../core/intercept';
import { isFilteredUrl } from './intercept';
import { extractShortInfo, extractWatchInfo, prune } from './walk';

/**
 * YouTube integration, running in the page's MAIN world at document_start.
 *
 * Approach informed by FilterTube (MIT) and BlockTube (GPL-3.0, read only):
 * prune InnerTube JSON before render by trapping ytInitialData and wrapping
 * fetch/XHR for /youtubei/v1/* endpoints. The code here is our own.
 *
 * Besides pruning feeds, it reports a verdict for the video a watch page or
 * Short is showing. That video can't be removed (the user opened it), so the
 * ISOLATED guard covers it with an overlay or skips to the next Short.
 */
export function startYouTube(state: FilterState, win: Window = window): void {
  const pruner: Pruner = (data, ctx) => {
    if (!state.active) return;
    const matcher = state.matcher;
    state.reportRemoved(prune(data, matcher));
    reportVerdicts(data, ctx.url, ctx.body, matcher);
  };

  trapGlobal(win, 'ytInitialData', pruner);
  wrapFetch(win, pruner, isFilteredUrl);
  wrapXhr(win, pruner, isFilteredUrl);
}

function reportVerdicts(data: unknown, url: string | undefined, body: string | undefined, matcher: Matcher) {
  if (url?.includes('/reel/reel_item_watch')) {
    const short = extractShortInfo(data, body);
    if (short) {
      const blocked =
        short.channels.some((c) => matcher.isBlockedChannel(c)) || matcher.match(...short.text).blocked;
      sendToIsolated({ type: 'video', kind: 'short', videoId: short.videoId, blocked });
    }
    return;
  }
  const watch = extractWatchInfo(data);
  if (watch) {
    const blocked = matcher.isBlockedChannel(watch.channelId) || matcher.match(watch.title, watch.channel).blocked;
    sendToIsolated({ type: 'video', kind: 'watch', videoId: watch.videoId, blocked });
  }
}
