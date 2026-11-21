import type { FilterState } from '../../core/filter-state';
import { trapGlobal, wrapFetch, wrapXhr, type Pruner } from './intercept';
import { prune } from './walk';

/**
 * YouTube integration, running in the page's MAIN world at document_start.
 *
 * Approach informed by FilterTube (MIT) and BlockTube (GPL-3.0, read only):
 * prune InnerTube JSON before render by trapping ytInitialData and wrapping
 * fetch/XHR for /youtubei/v1/* endpoints. The code here is our own.
 */
export function startYouTube(state: FilterState, win: Window = window): void {
  const pruner: Pruner = (data) => {
    if (!state.active) return;
    state.reportRemoved(prune(data, state.matcher));
  };

  trapGlobal(win, 'ytInitialData', pruner);
  wrapFetch(win, pruner);
  wrapXhr(win, pruner);
}
