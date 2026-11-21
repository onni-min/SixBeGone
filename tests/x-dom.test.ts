// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { HIDDEN_ATTR } from '../src/core/hider';
import { buildMatcher } from '../src/core/rules';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { createXScanner, tweetAuthors } from '../src/sites/x/dom';

const cell = (id: string, author: string, text: string) => `
  <div data-testid="cellInnerDiv" id="${id}">
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/${author}">${author}</a><a href="/${author}/status/1">2h</a></div>
      <div data-testid="tweetText">${text}</div>
    </article>
  </div>`;

describe('X DOM fallback', () => {
  it('hides GTA 6 tweet cells and trends, keeps the rest', () => {
    document.body.innerHTML = `
      ${cell('c1', 'alice', 'GTA 6 is out!!')}
      ${cell('c2', 'bob', 'Lunch time')}
      ${cell('c3', 'carol', 'look <img alt="Grand Theft Auto VI screenshot">')}
      <div data-testid="trend" id="t1"><span>Trending in Gaming</span><span>#GTA6</span></div>
      <div data-testid="trend" id="t2"><span>Sports</span><span>Derby day</span></div>`;
    const s = createXScanner(document, buildMatcher(DEFAULT_SETTINGS));
    expect(s.scan()).toBe(3);
    const hidden = [...document.querySelectorAll(`[${HIDDEN_ATTR}="hidden"]`)].map((e) => e.id).sort();
    expect(hidden).toEqual(['c1', 'c3', 't1']);
  });

  it('hides tweets from blocked accounts', () => {
    document.body.innerHTML = cell('c1', 'Leaker', 'hello') + cell('c2', 'friend', 'hello');
    const s = createXScanner(document, buildMatcher({ ...DEFAULT_SETTINGS, customChannels: ['@leaker'] }));
    s.scan();
    expect(document.getElementById('c1')!.getAttribute(HIDDEN_ATTR)).toBe('hidden');
    expect(document.getElementById('c2')!.getAttribute(HIDDEN_ATTR)).toBeNull();
  });

  it('reads author handles but not status links', () => {
    document.body.innerHTML = cell('c1', 'alice', 'x');
    expect(tweetAuthors(document.querySelector('article')!)).toEqual(['alice']);
  });
});

describe('X DOM fallback (redesign markup)', () => {
  const post = (i: number, handle: string, text: string, quote = '') => `
    <li data-index="${i}" id="li${i}">
      <div role="link" data-href="/${handle}/status/${i}00">
        <article class="flex flex-col">
          <span>${handle}</span><div>${text}</div>
          ${quote}
        </article>
      </div>
    </li>`;
  const quote = (handle: string, text: string) =>
    `<div role="link" data-slot="embedded-tweet-frame" data-href="/${handle}/status/999"><article><span>${handle}</span><div>${text}</div></article></div>`;

  it('hides rows whose post or quoted post matches, and trend rows', () => {
    document.body.innerHTML = `
      <ul>
        ${post(1, 'bryan_johnson', 'im going to buy gta6', quote('Brady_H', 'In GTA 6 you can literally do zone 2 cardio.'))}
        ${post(2, 'friend', 'Lunch', quote('other', 'nice view'))}
        ${post(3, 'quoter', 'lol', quote('leaker', 'Grand Theft Auto VI map'))}
      </ul>
      <ul>
        <li id="tr1"><div role="link" data-href="/i/trending/123"><span>GTA 6 Breaks Launch Sales Records</span></div></li>
        <li id="tr2"><div role="link" data-href="/i/trending/456"><span>Derby day</span></div></li>
      </ul>`;
    const s = createXScanner(document, buildMatcher(DEFAULT_SETTINGS));
    const n = s.scan();
    const hidden = [...document.querySelectorAll(`[${HIDDEN_ATTR}="hidden"]`)].map((e) => e.id).sort();
    expect(hidden).toEqual(['li1', 'li3', 'tr1']);
    expect(n).toBe(3);
  });

  it('reads authors from data-href, including the quoted author', () => {
    document.body.innerHTML = `<ul>${post(1, 'alice', 'x', quote('bob', 'y'))}</ul>`;
    expect(tweetAuthors(document.querySelector('article')!).sort()).toEqual(['alice', 'bob']);
  });

  it('blocks rows quoting a blocked account', () => {
    document.body.innerHTML = `<ul>${post(1, 'alice', 'x', quote('Leaker', 'y'))}${post(2, 'carol', 'z')}</ul>`;
    const s = createXScanner(document, buildMatcher({ ...DEFAULT_SETTINGS, customChannels: ['leaker'] }));
    s.scan();
    expect(document.getElementById('li1')!.getAttribute(HIDDEN_ATTR)).toBe('hidden');
    expect(document.getElementById('li2')!.getAttribute(HIDDEN_ATTR)).toBeNull();
  });
});
