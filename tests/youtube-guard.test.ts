// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compileMatcher, type Matcher } from '../src/core/matcher';
import { BUILTIN_RULES } from '../src/core/rules';
import { createGuard, currentVideo, OVERLAY_ID } from '../src/sites/youtube/guard';

let matcher: Matcher;
let active: boolean;
let removed: number;

const go = (path: string) => history.pushState({}, '', path);
const overlay = () => document.getElementById(OVERLAY_ID);
const click = (act: string) =>
  overlay()!.shadowRoot!.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!.click();

function makeGuard(skipCheckMs = 10) {
  return createGuard({
    doc: document,
    matcher: () => matcher,
    active: () => active,
    onRemoved: (n) => (removed += n),
    skipCheckMs,
  });
}

beforeEach(() => {
  matcher = compileMatcher(BUILTIN_RULES);
  active = true;
  removed = 0;
  document.body.innerHTML = '';
  overlay()?.remove();
  go('/');
});

describe('currentVideo', () => {
  it('reads watch and Shorts URLs', () => {
    expect(currentVideo(new URL('https://www.youtube.com/watch?v=abc&t=3') as unknown as Location)).toEqual({
      kind: 'watch',
      id: 'abc',
    });
    expect(currentVideo(new URL('https://www.youtube.com/shorts/x_Y-1') as unknown as Location)).toEqual({
      kind: 'short',
      id: 'x_Y-1',
    });
    expect(currentVideo(new URL('https://www.youtube.com/results?search_query=a') as unknown as Location)).toBeUndefined();
  });
});

describe('watch page overlay', () => {
  it('covers a GTA 6 video and keeps the player paused', () => {
    document.body.innerHTML = '<video></video>';
    const video = document.querySelector('video')!;
    const pause = vi.spyOn(video, 'pause');
    go('/watch?v=gta');
    const g = makeGuard();
    g.verdict('watch', 'gta', true);
    expect(overlay()).not.toBeNull();
    expect(pause).toHaveBeenCalled();
    video.dispatchEvent(new Event('play'));
    expect(pause).toHaveBeenCalledTimes(2);
    expect(removed).toBe(1);
  });

  it('does nothing for other videos or when off', () => {
    go('/watch?v=ok');
    const g = makeGuard();
    g.verdict('watch', 'ok', false);
    g.verdict('watch', 'other', true); // not the open video
    expect(overlay()).toBeNull();
    active = false;
    go('/watch?v=other');
    g.check();
    expect(overlay()).toBeNull();
  });

  it('"Watch anyway" lifts the overlay for that video only', () => {
    go('/watch?v=gta');
    const g = makeGuard();
    g.verdict('watch', 'gta', true);
    click('watch');
    expect(overlay()).toBeNull();
    g.check();
    expect(overlay()).toBeNull();
    g.verdict('watch', 'gta2', true);
    go('/watch?v=gta2');
    g.check();
    expect(overlay()).not.toBeNull();
  });

  it('removes the overlay when navigating away', () => {
    go('/watch?v=gta');
    const g = makeGuard();
    g.verdict('watch', 'gta', true);
    go('/');
    g.check();
    expect(overlay()).toBeNull();
  });

  it('falls back to the page title once the page shows the right video', () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="old"></ytd-watch-flexy>
      <ytd-watch-metadata><h1><yt-formatted-string>Grand Theft Auto VI review</yt-formatted-string></h1></ytd-watch-metadata>`;
    go('/watch?v=new');
    const g = makeGuard();
    g.check();
    expect(overlay()).toBeNull(); // stale title from the previous video
    document.querySelector('ytd-watch-flexy')!.setAttribute('video-id', 'new');
    g.check();
    expect(overlay()).not.toBeNull();
  });

  it('reset re-evaluates with new settings', () => {
    document.body.innerHTML = `<ytd-watch-flexy video-id="v"></ytd-watch-flexy>
      <ytd-watch-metadata><h1><yt-formatted-string>GTA 6 patch notes</yt-formatted-string></h1></ytd-watch-metadata>`;
    go('/watch?v=v');
    const g = makeGuard();
    g.verdict('watch', 'v', true);
    expect(overlay()).not.toBeNull();
    matcher = compileMatcher(BUILTIN_RULES, { allowTerms: ['patch notes'] });
    g.reset();
    expect(overlay()).toBeNull();
  });
});

describe('Shorts', () => {
  it('skips a GTA 6 Short with the next button', () => {
    document.body.innerHTML = '<div id="navigation-button-down"><button></button></div>';
    const next = vi.fn();
    document.querySelector('#navigation-button-down button')!.addEventListener('click', next);
    go('/shorts/s1');
    const g = makeGuard();
    g.verdict('short', 's1', true);
    expect(next).toHaveBeenCalledTimes(1);
    expect(removed).toBe(1);
    g.check(); // only once per Short
    expect(next).toHaveBeenCalledTimes(1);
    expect(overlay()).toBeNull();
  });

  it('falls back to the overlay when the skip does not move on', async () => {
    go('/shorts/last');
    const g = makeGuard(5);
    g.verdict('short', 'last', true);
    await new Promise((r) => setTimeout(r, 20));
    expect(overlay()).not.toBeNull();
  });

  it('does not cover the next Short after a successful skip', async () => {
    document.body.innerHTML = '<div id="navigation-button-down"><button></button></div>';
    document.querySelector('button')!.addEventListener('click', () => go('/shorts/s2'));
    go('/shorts/s1');
    const g = makeGuard(5);
    g.verdict('short', 's1', true);
    await new Promise((r) => setTimeout(r, 20));
    expect(overlay()).toBeNull();
  });

  it('judges the active Short from the page when no data verdict exists', () => {
    document.body.innerHTML = `
      <div id="navigation-button-down"><button></button></div>
      <ytd-reel-video-renderer is-active><h2>#gta6 secret ending</h2></ytd-reel-video-renderer>`;
    const next = vi.fn();
    document.querySelector('button')!.addEventListener('click', next);
    go('/shorts/s3');
    makeGuard().check();
    expect(next).toHaveBeenCalled();
  });
});
