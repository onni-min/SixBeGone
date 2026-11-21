/**
 * Page-level fallback for X (ISOLATED world): hides tweets and trends the
 * network layer missed. Class names are generated, so only structure and
 * stable attributes are used. Covers both the old layout (data-testid
 * attributes, cellInnerDiv rows) and the late-2026 redesign (posts are
 * <li> rows holding [role=link][data-href="/user/status/…"] > article).
 */
import { createHider, elementText, type Hider } from '../../core/hider';
import type { Matcher } from '../../core/matcher';

const TWEET = [
  'article[data-testid="tweet"]', // old layout
  '[role="link"][data-href*="/status/"] > article', // redesign
].join(',');
const TREND = ['[data-testid="trend"]', '[data-href^="/i/trending/"]', 'a[href^="/i/trending/"]'].join(',');

/** The row to hide: the list cell holding a post or trend. */
function row(el: Element): Element {
  return el.closest('[data-testid="cellInnerDiv"]') ?? el.closest('li') ?? el;
}

const HANDLE = /^\/([A-Za-z0-9_]{1,15})(?:$|\/status\/)/;
const NOT_HANDLES = new Set(['i', 'home', 'explore', 'search', 'settings', 'notifications', 'messages', 'compose']);

/** Handles of a tweet's author (and a quoted tweet's author). */
export function tweetAuthors(el: Element): string[] {
  const out = new Set<string>();
  const add = (href: string | null) => {
    const h = href ? HANDLE.exec(href)?.[1] : undefined;
    if (h && !NOT_HANDLES.has(h.toLowerCase())) out.add(h);
  };
  // Old layout: author line links.
  for (const a of el.querySelectorAll('[data-testid="User-Name"] a[href^="/"]')) add(a.getAttribute('href'));
  // Redesign: the post (and any quoted post) is a link to /handle/status/id.
  add(el.closest('[data-href]')?.getAttribute('data-href') ?? null);
  for (const q of el.querySelectorAll('[data-href*="/status/"]')) add(q.getAttribute('data-href'));
  return [...out];
}

export function createXScanner(root: ParentNode, initial: Matcher): Hider {
  return createHider(root, initial, [
    {
      selector: TWEET,
      // Timelines are lists of rows; hide the whole row. A quoted post is a
      // nested article in the same row, so the row is judged once on the
      // outer article, whose text includes the quote.
      container: row,
      text: (el) => elementText(el),
      authors: tweetAuthors,
    },
    { selector: TREND, container: row, text: (el) => elementText(el) },
  ]);
}
