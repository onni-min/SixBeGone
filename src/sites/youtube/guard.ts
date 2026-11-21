/**
 * Guards the one video the user has open, which can't simply be removed:
 *   - a GTA 6 watch page gets a full overlay and its player is kept paused
 *   - a GTA 6 Short is skipped to the next one (overlay if skipping fails)
 *
 * Verdicts come from the MAIN world (judged on the data YouTube loaded for
 * the video, before it renders) and, as a fallback, from the page itself.
 * Runs in the ISOLATED world.
 */
import type { Matcher } from '../../core/matcher';
import { cardChannels, cardText } from './dom';

export interface GuardDeps {
  doc: Document;
  matcher: () => Matcher;
  active: () => boolean;
  onRemoved: (count: number) => void;
  /** Delay before checking whether a Short skip worked. */
  skipCheckMs?: number;
}

export interface Guard {
  verdict(kind: 'watch' | 'short', videoId: string, blocked: boolean): void;
  /** Re-evaluate the current page (navigation, DOM change, settings change). */
  check(): void;
  /** Forget cached verdicts (settings changed). */
  reset(): void;
}

type Current = { kind: 'watch' | 'short'; id: string };

export const OVERLAY_ID = 'sixbegone-overlay';

const WATCH_TITLE = [
  'ytd-watch-metadata h1 yt-formatted-string',
  'ytd-watch-metadata #title h1',
  '#above-the-fold #title h1',
  'h1.ytd-watch-metadata',
  'ytm-slim-video-information-renderer h2', // m.youtube.com
].join(',');
const WATCH_CHANNEL = 'ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a, ytm-slim-owner-renderer a';
const ACTIVE_SHORT = 'ytd-reel-video-renderer[is-active], ytm-reel-player-overlay-renderer';
const NEXT_SHORT_BUTTON =
  '#navigation-button-down button, #navigation-button-down [role="button"], button[aria-label="Next video"]';

export function currentVideo(loc: Location): Current | undefined {
  if (loc.pathname === '/watch') {
    const id = new URLSearchParams(loc.search).get('v');
    return id ? { kind: 'watch', id } : undefined;
  }
  const short = /^\/shorts\/([\w-]+)/.exec(loc.pathname);
  return short?.[1] ? { kind: 'short', id: short[1] } : undefined;
}

export function createGuard(deps: GuardDeps): Guard {
  const { doc } = deps;
  const win = doc.defaultView!;
  const verdicts = new Map<string, boolean>();
  const allowed = new Set<string>();
  const skipped = new Set<string>();
  let overlayFor: string | undefined;

  // Keep the player paused while the overlay is up. `play` doesn't bubble,
  // so listen in the capture phase.
  doc.addEventListener(
    'play',
    (e) => {
      if (overlayFor && e.target instanceof win.HTMLMediaElement) e.target.pause();
    },
    true,
  );

  const pauseAll = () => {
    for (const v of doc.querySelectorAll('video')) v.pause();
  };

  const domVerdict = (cur: Current): boolean | undefined => {
    const m = deps.matcher();
    if (cur.kind === 'watch') {
      // The title element keeps the previous video's title for a moment
      // during navigation, so only trust it once the page says which video it shows.
      const flexy = doc.querySelector('ytd-watch-flexy');
      if (flexy && flexy.getAttribute('video-id') !== cur.id) return undefined;
      const title = doc.querySelector(WATCH_TITLE)?.textContent?.trim();
      if (!title) return undefined;
      const channelEl = doc.querySelector(WATCH_CHANNEL);
      const channel = channelEl?.textContent?.trim();
      const channels = channelEl?.parentElement ? cardChannels(channelEl.parentElement) : [];
      return channels.some((c) => m.isBlockedChannel(c)) || m.match(title, channel).blocked;
    }
    const reel = doc.querySelector(ACTIVE_SHORT);
    if (!reel) return undefined;
    const text = cardText(reel);
    if (!text.length) return undefined;
    return cardChannels(reel).some((c) => m.isBlockedChannel(c)) || m.match(...text).blocked;
  };

  const showOverlay = (id: string) => {
    pauseAll();
    if (overlayFor === id && doc.getElementById(OVERLAY_ID)) return;
    hideOverlay();
    overlayFor = id;
    doc.documentElement.append(buildOverlay(doc, {
      back: () => {
        if (win.history.length > 1) win.history.back();
        else win.location.assign('/');
      },
      watch: () => {
        allowed.add(id);
        hideOverlay();
      },
    }));
    deps.onRemoved(1);
  };

  const hideOverlay = () => {
    overlayFor = undefined;
    doc.getElementById(OVERLAY_ID)?.remove();
  };

  const skipShort = (id: string) => {
    skipped.add(id);
    pauseAll();
    const button = doc.querySelector<HTMLElement>(NEXT_SHORT_BUTTON);
    if (button) button.click();
    else {
      doc.dispatchEvent(
        new win.KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }),
      );
    }
    deps.onRemoved(1);
    // Last Short in the feed, or the skip didn't take: cover it instead.
    win.setTimeout(() => {
      const cur = currentVideo(win.location);
      if (cur?.kind === 'short' && cur.id === id && !allowed.has(id) && deps.active()) showOverlay(id);
    }, deps.skipCheckMs ?? 1500);
  };

  const check = () => {
    const cur = currentVideo(win.location);
    if (!deps.active() || !cur || allowed.has(cur.id)) return hideOverlay();
    if (overlayFor && overlayFor !== cur.id) hideOverlay();

    const blocked = verdicts.get(cur.id) ?? domVerdict(cur);
    if (!blocked) {
      if (overlayFor === cur.id && verdicts.get(cur.id) === false) hideOverlay();
      return;
    }
    if (cur.kind === 'watch') showOverlay(cur.id);
    else if (!skipped.has(cur.id)) skipShort(cur.id);
  };

  return {
    verdict(_kind, videoId, blocked) {
      verdicts.set(videoId, blocked);
      check();
    },
    check,
    reset() {
      verdicts.clear();
      skipped.clear();
      hideOverlay();
      check();
    },
  };
}

function buildOverlay(doc: Document, actions: { back: () => void; watch: () => void }): HTMLElement {
  const host = doc.createElement('div');
  host.id = OVERLAY_ID;
  // Below YouTube's top bar so search and navigation stay usable.
  host.style.cssText = 'position:fixed;inset:56px 0 0 0;z-index:2000;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        background: #0f0f10; color: #f1f1f1; font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      .card { max-width: 420px; padding: 24px; text-align: center; }
      .icon {
        width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 50%; border: 6px solid #e0457b;
        display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 800;
        background: linear-gradient(45deg, transparent 46%, #e0457b 46%, #e0457b 54%, transparent 54%);
      }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { margin: 0 0 20px; opacity: .75; }
      .row { display: flex; gap: 12px; justify-content: center; }
      button {
        font: inherit; font-size: 14px; padding: 8px 16px; border-radius: 18px; cursor: pointer;
        border: 1px solid #555; background: transparent; color: inherit;
      }
      button.primary { background: #e0457b; border-color: #e0457b; color: #fff; }
    </style>
    <div class="wrap" role="dialog" aria-modal="true" aria-labelledby="sbg-title">
      <div class="card">
        <div class="icon">6</div>
        <h1 id="sbg-title">SixBeGone hid this GTA 6 video</h1>
        <p>It looks like it's about GTA 6, so it's covered to keep you spoiler-free.</p>
        <div class="row">
          <button class="primary" data-act="back">Go back</button>
          <button data-act="watch">Watch anyway</button>
        </div>
      </div>
    </div>`;
  root.querySelector('[data-act="back"]')!.addEventListener('click', actions.back);
  root.querySelector('[data-act="watch"]')!.addEventListener('click', actions.watch);
  return host;
}
