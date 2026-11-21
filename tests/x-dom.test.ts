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
