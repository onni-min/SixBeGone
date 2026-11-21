import { pathFilter } from '../../core/intercept';

/** YouTube endpoints whose responses contain feed items or the open video. */
export const FILTERED_ENDPOINTS =
  /\/youtubei\/v1\/(browse|search|next|get_watch|reel\/reel_watch_sequence|reel\/reel_item_watch)(\?|$)/;

export const isFilteredUrl = pathFilter(FILTERED_ENDPOINTS);
