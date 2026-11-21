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

export const HIDDEN_ATTR = 'data-sixbegone';
export const HIDE_CSS = `[${HIDDEN_ATTR}="hidden"]{display:none!important}`;

const MAX_CHARS = 3000;

/** Text of a card: its visible text plus titles/labels only kept in attributes. */
export function cardText(el: Element): string[] {
  const parts: string[] = [];
  const visible = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (visible) parts.push(visible.slice(0, MAX_CHARS));
  for (const a of el.querySelectorAll('[title], [aria-label]')) {
    const t = a.getAttribute('title') ?? '';
    const l = a.getAttribute('aria-label') ?? '';
    if (t && !visible.includes(t)) parts.push(t);
    if (l && !visible.includes(l)) parts.push(l);
    if (parts.length > 20) break;
  }
  return parts;
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

export interface Scanner {
  /** Scan the page. Returns how many elements were newly hidden. */
  scan(): number;
  /** Unhide everything (filter turned off). */
  reset(): void;
  setMatcher(m: Matcher): void;
}

export function createScanner(root: ParentNode, initial: Matcher): Scanner {
  let matcher = initial;
  // Last text each element was judged on, so unchanged cards are skipped.
  // YouTube reuses card elements for new videos, so a changed text means a
  // new item and must be judged again.
  let seen = new WeakMap<Element, string>();

  const judge = (el: Element, texts: string[]): boolean => {
    const key = texts.join('\u0001');
    if (seen.get(el) === key) return false;
    seen.set(el, key);

    const blocked = cardChannels(el).some((c) => matcher.isBlockedChannel(c)) || matcher.match(...texts).blocked;
    const wasHidden = el.getAttribute(HIDDEN_ATTR) === 'hidden';
    if (blocked && !wasHidden) {
      el.setAttribute(HIDDEN_ATTR, 'hidden');
      return true;
    }
    if (!blocked && wasHidden) el.removeAttribute(HIDDEN_ATTR);
    return false;
  };

  return {
    scan() {
      let hidden = 0;
      const cards = new Set<Element>();
      for (const el of root.querySelectorAll(CARD_SELECTOR)) cards.add(outermostCard(el));
      for (const card of cards) if (judge(card, cardText(card))) hidden++;

      for (const shelf of root.querySelectorAll(SHELF_SELECTOR)) {
        const heading = shelf.querySelector(SHELF_HEADING_SELECTOR)?.textContent?.trim();
        if (heading && judge(shelf, [heading])) hidden++;
      }
      return hidden;
    },
    reset() {
      for (const el of root.querySelectorAll(`[${HIDDEN_ATTR}]`)) el.removeAttribute(HIDDEN_ATTR);
      seen = new WeakMap();
    },
    setMatcher(m) {
      matcher = m;
      seen = new WeakMap();
    },
  };
}
