/**
 * Generic page-level hider used by every site's fallback layer (ISOLATED
 * world). Each site describes its targets: which elements to judge, which
 * element to hide, and how to read their text and authors. Hidden elements
 * get an attribute matched by one CSS rule rather than being removed, since
 * sites built on React/Polymer reuse their nodes and break if they vanish.
 */
import type { Matcher } from './matcher';

export const HIDDEN_ATTR = 'data-sixbegone';
export const HIDE_CSS = `[${HIDDEN_ATTR}="hidden"]{display:none!important}`;

export interface HideTarget {
  /** Elements to judge. */
  selector: string;
  /** Element to hide for a match (defaults to the matched element). */
  container?: (el: Element) => Element;
  /** Text to judge. Empty means "not ready yet, skip". */
  text: (el: Element) => string[];
  /** Author handles/ids, checked against the blocked list. */
  authors?: (el: Element) => string[];
}

export interface Hider {
  /** Scan the page. Returns how many elements were newly hidden. */
  scan(): number;
  /** Unhide everything (filter turned off). */
  reset(): void;
  setMatcher(m: Matcher): void;
}

export function createHider(root: ParentNode, initial: Matcher, targets: HideTarget[]): Hider {
  let matcher = initial;
  // Last text each element was judged on, so unchanged elements are skipped.
  // Sites reuse elements for new content, so changed text means a new item.
  let seen = new WeakMap<Element, string>();

  const judge = (el: Element, texts: string[], authors: string[]): boolean => {
    const key = texts.join('\u0001') + '\u0002' + authors.join('\u0001');
    if (seen.get(el) === key) return false;
    seen.set(el, key);

    const blocked = authors.some((a) => matcher.isBlockedChannel(a)) || matcher.match(...texts).blocked;
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
      for (const t of targets) {
        const containers = new Map<Element, Element>();
        for (const el of root.querySelectorAll(t.selector)) {
          const box = t.container ? t.container(el) : el;
          if (!containers.has(box)) containers.set(box, el);
        }
        for (const [box, el] of containers) {
          const texts = t.text(el);
          if (!texts.length) continue;
          if (judge(box, texts, t.authors?.(el) ?? [])) hidden++;
        }
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

/** Visible text of an element plus titles/labels/alt text kept only in attributes. */
export function elementText(el: Element, maxChars = 3000): string[] {
  const parts: string[] = [];
  const visible = spacedText(el, maxChars);
  if (visible) parts.push(visible.slice(0, maxChars));
  for (const a of el.querySelectorAll('[title], [aria-label], img[alt]')) {
    for (const attr of ['title', 'aria-label', 'alt']) {
      const v = a.getAttribute(attr);
      if (v && !visible.includes(v)) parts.push(v);
    }
    if (parts.length > 24) break;
  }
  return parts;
}

/**
 * Text of an element with a space between text nodes. textContent glues
 * neighbouring elements together ("@Brady_H" + "Nov 19" + "Holy…" becomes
 * "@Brady_HNov 19Holy…"), which can merge a name into the first word of a
 * post and break phrase matching.
 */
export function spacedText(el: Element, maxChars = 3000): string {
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  const parts: string[] = [];
  let len = 0;
  for (let n = walker.nextNode(); n && len < maxChars; n = walker.nextNode()) {
    const t = n.nodeValue;
    if (t && t.trim()) {
      parts.push(t);
      len += t.length;
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}
