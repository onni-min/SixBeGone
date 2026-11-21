/**
 * Page-level fallback for X (ISOLATED world): hides tweets and trends the
 * network layer missed. X's class names are generated, but its data-testid
 * attributes have stayed stable for years, so only those are used.
 */
import { createHider, elementText, type Hider } from '../../core/hider';
import type { Matcher } from '../../core/matcher';

const TWEET = 'article[data-testid="tweet"]';
const TREND = '[data-testid="trend"]';

/** Handles linked from a tweet's author line (and a quoted tweet's). */
export function tweetAuthors(el: Element): string[] {
  const out = new Set<string>();
  for (const a of el.querySelectorAll('[data-testid="User-Name"] a[href^="/"]')) {
    const handle = /^\/([A-Za-z0-9_]{1,15})(?:$|[/?#])/.exec(a.getAttribute('href') ?? '')?.[1];
    if (handle) out.add(handle);
  }
  return [...out];
}

export function createXScanner(root: ParentNode, initial: Matcher): Hider {
  return createHider(root, initial, [
    {
      selector: TWEET,
      // Timelines are virtualized lists of cells; hide the whole cell.
      container: (el) => el.closest('[data-testid="cellInnerDiv"]') ?? el,
      text: (el) => elementText(el),
      authors: tweetAuthors,
    },
    { selector: TREND, text: (el) => elementText(el) },
  ]);
}
