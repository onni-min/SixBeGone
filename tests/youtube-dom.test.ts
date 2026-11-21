// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { compileMatcher } from '../src/core/matcher';
import { BUILTIN_RULES } from '../src/core/rules';
import { cardChannels, createScanner, HIDDEN_ATTR } from '../src/sites/youtube/dom';

const matcher = compileMatcher(BUILTIN_RULES);
const hidden = () =>
  [...document.querySelectorAll(`[${HIDDEN_ATTR}="hidden"]`)].map((el) => el.id || el.tagName.toLowerCase());

beforeEach(() => {
  document.body.innerHTML = `
    <ytd-rich-grid-renderer>
      <ytd-rich-item-renderer id="r1">
        <yt-lockup-view-model>
          <h3><a href="/watch?v=1">GTA 6 Trailer 3 Breakdown</a></h3>
          <a href="/@somechannel">Some Channel</a>
        </yt-lockup-view-model>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="r2">
        <yt-lockup-view-model><h3><a href="/watch?v=2">Cooking pasta</a></h3></yt-lockup-view-model>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="r3">
        <yt-lockup-view-model><a href="/watch?v=3" aria-label="I finished Grand Theft Auto VI"></a></yt-lockup-view-model>
      </ytd-rich-item-renderer>
    </ytd-rich-grid-renderer>
    <ytd-rich-shelf-renderer id="shelf1"><h2><span id="title">Latest GTA 6 news</span></h2></ytd-rich-shelf-renderer>
    <ytd-rich-shelf-renderer id="shelf2"><h2><span id="title">Shorts</span></h2></ytd-rich-shelf-renderer>
    <ytd-compact-video-renderer id="c1"><span id="video-title">GTA 5 Online heist guide</span></ytd-compact-video-renderer>
  `;
});

describe('DOM fallback scanner', () => {
  it('hides the outermost card for matching text, including aria-labels, and matching shelves', () => {
    const s = createScanner(document, matcher);
    expect(s.scan()).toBe(3);
    expect(hidden().sort()).toEqual(['r1', 'r3', 'shelf1']);
  });

  it('does not count the same card twice', () => {
    const s = createScanner(document, matcher);
    s.scan();
    expect(s.scan()).toBe(0);
  });

  it('re-judges a reused card when its text changes', () => {
    const s = createScanner(document, matcher);
    s.scan();
    document.querySelector('#r2 h3 a')!.textContent = 'GTA 6 ending explained';
    expect(s.scan()).toBe(1);
    document.querySelector('#r1 h3 a')!.textContent = 'Woodworking basics';
    s.scan();
    expect(hidden().sort()).toEqual(['r2', 'r3', 'shelf1']);
  });

  it('reset unhides everything', () => {
    const s = createScanner(document, matcher);
    s.scan();
    s.reset();
    expect(hidden()).toEqual([]);
  });

  it('applies a new matcher (custom channels)', () => {
    const s = createScanner(document, matcher);
    s.scan();
    s.setMatcher(compileMatcher(BUILTIN_RULES, { customChannels: ['@somechannel'], allowTerms: ['grand theft auto vi'] }));
    s.scan();
    expect(hidden().sort()).toEqual(['r1', 'shelf1']);
  });
});

describe('cardChannels', () => {
  it('reads handles and channel ids from links', () => {
    const el = document.createElement('div');
    el.innerHTML = '<a href="/@Foo">x</a><a href="/channel/UCabc_1-2">y</a><a href="/watch?v=1">z</a>';
    expect(cardChannels(el).sort()).toEqual(['@Foo', 'UCabc_1-2']);
  });
});
