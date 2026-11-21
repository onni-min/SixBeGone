import type { FilterState } from '../../core/filter-state';

/**
 * YouTube integration, running in the page's MAIN world at document_start.
 *
 * M0 wires up the filter state only. M1 adds, in this folder:
 *   - intercept.ts: wrap fetch/XHR for /youtubei/v1/(browse|search|next|reel|guide)
 *     and trap window.ytInitialData / ytInitialPlayerResponse with a setter
 *   - walk.ts: generic JSON walker that finds item renderers and view models
 *     (richItemRenderer, videoRenderer, lockupViewModel, shortsLockupViewModel,
 *     commentThreadRenderer, …), extracts their text and removes matches
 *
 * References: FilterTube js/seed.js + js/filter_logic.js (MIT, may adapt with
 * attribution in THIRD_PARTY_NOTICES.md); BlockTube src/scripts/seed.js +
 * inject.js (GPL-3.0, read only, do not copy).
 */
export function startYouTube(state: FilterState): void {
  void state;
}
