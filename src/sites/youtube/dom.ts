/**
 * Page-level fallback for YouTube. Runs in the ISOLATED world.
 *
 * The network layer removes almost everything before it renders. This
 * catches the rest: layouts it doesn't recognize yet, data that arrives
 * through a path it doesn't hook, and settings changes on an already-loaded
 * page. It hides cards with an attribute + CSS rule rather than deleting
 * nodes, because YouTube's components reuse their elements and break if
 * nodes disappear under them. That also makes unhiding trivial.
 */
import { createHider, elementText, type Hider } from '../../core/hider';
import type { Matcher } from '../../core/matcher';

/** Cards that hold one piece of content. The outermost match is hidden. */
export const CARD_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-playlist-renderer',
  'ytd-compact-playlist-renderer',
  'ytd-radio-renderer',
  'ytd-compact-radio-renderer',
  'ytd-reel-item-renderer',
  'ytd-channel-renderer',
  'ytd-post-renderer',
  'ytd-backstage-post-thread-renderer',
  'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model',
  'ytm-shorts-lockup-view-model-v2',
  // m.youtube.com
  'ytm-video-with-context-renderer',
  'ytm-compact-video-renderer',
  'ytm-rich-item-renderer',
  'ytm-reel-item-renderer',
].join(',');

/** Rows with a heading; hidden whole when the heading matches. */
export const SHELF_SELECTOR = ['ytd-rich-shelf-renderer', 'ytd-reel-shelf-renderer', 'ytd-shelf-renderer'].join(',');
const SHELF_HEADING_SELECTOR = '#title, #title-text, h2';

export { HIDDEN_ATTR, HIDE_CSS } from '../../core/hider';

/** Text of a card: its visible text plus titles/labels only kept in attributes. */
export function cardText(el: Element): string[] {
  return elementText(el);
}

/** Channel handles and ids linked from a card. */
export function cardChannels(el: Element): string[] {
  const out = new Set<string>();
  for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href^="/@"], a[href^="/channel/UC"]')) {
    const href = a.getAttribute('href') ?? '';
    const handle = /^\/(@[^/?#]+)/.exec(href)?.[1];
    const id = /^\/channel\/(UC[\w-]+)/.exec(href)?.[1];
    if (handle) out.add(decodeURIComponent(handle));
    if (id) out.add(id);
  }
  return [...out];
}

function outermostCard(el: Element): Element {
  let top = el;
  for (let p = el.parentElement?.closest(CARD_SELECTOR); p; p = p.parentElement?.closest(CARD_SELECTOR)) {
    top = p;
  }
  return top;
}

export type Scanner = Hider;

export function createScanner(root: ParentNode, initial: Matcher): Scanner {
  return createHider(root, initial, [
    { selector: CARD_SELECTOR, container: outermostCard, text: cardText, authors: cardChannels },
    {
      selector: SHELF_SELECTOR,
      text: (shelf) => {
        const heading = shelf.querySelector(SHELF_HEADING_SELECTOR)?.textContent?.trim();
        return heading ? [heading] : [];
      },
    },
  ]);
}
