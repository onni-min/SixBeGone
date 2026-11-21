import { describe, expect, it, vi } from 'vitest';
import { isFilteredUrl, trapGlobal, wrapFetch, wrapXhr, type Pruner } from '../src/sites/youtube/intercept';

vi.stubGlobal('location', new URL('https://www.youtube.com/'));

/** Pruner that drops any array element containing "GTA 6". */
const pruner: Pruner = (data) => {
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) {
        if (JSON.stringify(v[i]).includes('GTA 6')) v.splice(i, 1);
        else walk(v[i]);
      }
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(data);
};

const feed = () => ({ items: [{ title: 'GTA 6 trailer' }, { title: 'Cats' }] });

describe('isFilteredUrl', () => {
  it.each([
    ['/youtubei/v1/browse?prettyPrint=false', true],
    ['https://www.youtube.com/youtubei/v1/search?key=x', true],
    ['/youtubei/v1/next', true],
    ['/youtubei/v1/reel/reel_watch_sequence?x=1', true],
    ['/youtubei/v1/player', false],
    ['/youtubei/v1/log_event', false],
    ['/youtubei/v1/browse/edit_playlist', false],
    ['https://i.ytimg.com/vi/x/hq720.jpg', false],
  ])('%s -> %s', (url, expected) => {
    expect(isFilteredUrl(url)).toBe(expected);
  });
});

describe('trapGlobal', () => {
  it('prunes ytInitialData when the page assigns it', () => {
    const win = {} as Window & { ytInitialData?: unknown };
    trapGlobal(win, 'ytInitialData', pruner);
    win.ytInitialData = feed();
    expect(win.ytInitialData).toEqual({ items: [{ title: 'Cats' }] });
  });

  it('prunes a value that was already there', () => {
    const win = { ytInitialData: feed() } as unknown as Window & { ytInitialData: unknown };
    trapGlobal(win, 'ytInitialData', pruner);
    expect(win.ytInitialData).toEqual({ items: [{ title: 'Cats' }] });
  });

  it('leaves non-configurable properties alone', () => {
    const win = {} as Window;
    Object.defineProperty(win, 'ytInitialData', { value: feed(), configurable: false });
    expect(() => trapGlobal(win, 'ytInitialData', pruner)).not.toThrow();
  });

  it('survives a pruner that throws', () => {
    const win = {} as Window & { ytInitialData?: unknown };
    trapGlobal(win, 'ytInitialData', () => {
      throw new Error('boom');
    });
    win.ytInitialData = feed();
    expect(win.ytInitialData).toEqual(feed());
  });
});

describe('wrapFetch', () => {
  const makeWin = (body: unknown, init: ResponseInit = {}) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200, ...init }));
    return { fetch } as unknown as Window;
  };

  it('prunes /youtubei/v1/browse responses', async () => {
    const win = makeWin(feed());
    wrapFetch(win, pruner);
    const res = await win.fetch('/youtubei/v1/browse?prettyPrint=false', { method: 'POST' });
    expect(await res.json()).toEqual({ items: [{ title: 'Cats' }] });
  });

  it('accepts Request objects', async () => {
    const win = makeWin(feed());
    wrapFetch(win, pruner);
    const res = await win.fetch(new Request('https://www.youtube.com/youtubei/v1/search'));
    expect(await res.json()).toEqual({ items: [{ title: 'Cats' }] });
  });

  it('passes other URLs through untouched', async () => {
    const win = makeWin(feed());
    wrapFetch(win, pruner);
    const res = await win.fetch('/youtubei/v1/player');
    expect(await res.json()).toEqual(feed());
  });

  it('passes error responses and non-JSON through', async () => {
    const errWin = makeWin(feed(), { status: 500 });
    wrapFetch(errWin, pruner);
    expect((await errWin.fetch('/youtubei/v1/browse')).status).toBe(500);

    const textWin = { fetch: vi.fn(async () => new Response('not json')) } as unknown as Window;
    wrapFetch(textWin, pruner);
    expect(await (await textWin.fetch('/youtubei/v1/browse')).text()).toBe('not json');
  });

  it('keeps status and headers', async () => {
    const win = makeWin(feed(), { headers: { 'x-test': '1' } });
    wrapFetch(win, pruner);
    const res = await win.fetch('/youtubei/v1/next');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-test')).toBe('1');
  });
});

describe('wrapXhr', () => {
  /** Tiny XMLHttpRequest stand-in with prototype getters like the real one. */
  function fakeXhrWindow(body: string) {
    class FakeXHR {
      readyState = 0;
      responseType: XMLHttpRequestResponseType = '';
      url = '';
      open(_m: string, url: string) {
        this.url = url;
      }
      finish() {
        this.readyState = 4;
      }
    }
    Object.defineProperty(FakeXHR.prototype, 'responseText', {
      configurable: true,
      get(this: FakeXHR) {
        return this.readyState === 4 ? body : '';
      },
    });
    Object.defineProperty(FakeXHR.prototype, 'response', {
      configurable: true,
      get(this: FakeXHR) {
        if (this.readyState !== 4) return null;
        return this.responseType === 'json' ? JSON.parse(body) : body;
      },
    });
    return { XMLHttpRequest: FakeXHR } as unknown as Window & { XMLHttpRequest: typeof FakeXHR };
  }

  it('filters responseText and response for matching URLs', () => {
    const win = fakeXhrWindow(JSON.stringify(feed()));
    wrapXhr(win, pruner);
    const xhr = new win.XMLHttpRequest() as unknown as XMLHttpRequest & { finish(): void };
    xhr.open('POST', '/youtubei/v1/browse');
    expect(xhr.responseText).toBe(''); // not done yet
    xhr.finish();
    expect(JSON.parse(xhr.responseText)).toEqual({ items: [{ title: 'Cats' }] });
    expect(JSON.parse(xhr.response as string)).toEqual({ items: [{ title: 'Cats' }] });
  });

  it('filters responseType json', () => {
    const win = fakeXhrWindow(JSON.stringify(feed()));
    wrapXhr(win, pruner);
    const xhr = new win.XMLHttpRequest() as unknown as XMLHttpRequest & { finish(): void };
    xhr.responseType = 'json';
    xhr.open('POST', '/youtubei/v1/next');
    xhr.finish();
    expect(xhr.response).toEqual({ items: [{ title: 'Cats' }] });
  });

  it('leaves other URLs alone', () => {
    const win = fakeXhrWindow(JSON.stringify(feed()));
    wrapXhr(win, pruner);
    const xhr = new win.XMLHttpRequest() as unknown as XMLHttpRequest & { finish(): void };
    xhr.open('GET', '/youtubei/v1/player');
    xhr.finish();
    expect(JSON.parse(xhr.responseText)).toEqual(feed());
  });

  it('falls back to the raw text when the body is not JSON', () => {
    const win = fakeXhrWindow('<html>');
    wrapXhr(win, pruner);
    const xhr = new win.XMLHttpRequest() as unknown as XMLHttpRequest & { finish(): void };
    xhr.open('GET', '/youtubei/v1/browse');
    xhr.finish();
    expect(xhr.responseText).toBe('<html>');
  });
});
