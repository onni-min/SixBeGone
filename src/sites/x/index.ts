import type { FilterState } from '../../core/filter-state';
import { wrapFetch, wrapXhr, type Pruner } from '../../core/intercept';
import { isFilteredXUrl, prune } from './walk';

/**
 * X integration, running in the page's MAIN world at document_start, before
 * X's bundle captures fetch. Timelines, threads, search, profiles and trends
 * all arrive as /i/api/graphql/* responses; matching entries are removed
 * before React renders them.
 */
export function startX(state: FilterState, win: Window = window): void {
  const pruner: Pruner = (data) => {
    if (!state.active) return;
    state.reportRemoved(prune(data, state.matcher));
  };
  wrapFetch(win, pruner, isFilteredXUrl);
  wrapXhr(win, pruner, isFilteredXUrl);
}
