import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onIsolatedMessage, type ToIsolated } from '../src/core/bridge';
import { createFilterState } from '../src/core/filter-state';
import { startYouTube } from '../src/sites/youtube';
import * as f from './fixtures/youtube';

beforeEach(() => {
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('location', new URL('https://www.youtube.com/'));
});

function setup(responses: Record<string, unknown>) {
  const messages: ToIsolated[] = [];
  onIsolatedMessage((m) => messages.push(m));
  const win = {
    fetch: vi.fn(async (input: string) => {
      const key = Object.keys(responses).find((k) => input.includes(k));
      return new Response(JSON.stringify(key ? responses[key] : {}));
    }),
  } as unknown as Window & { ytInitialData?: unknown };
  startYouTube(createFilterState(), win);
  return { win, messages, videos: () => messages.filter((m) => m.type === 'video') };
}

describe('startYouTube', () => {
  it('reports a blocked watch page from the initial data and prunes it', () => {
    const { win, videos } = setup({});
    win.ytInitialData = f.watchNextFor('gta', 'GTA 6 Trailer 3', 'Rockstar Games', 'Cats');
    expect(videos()).toEqual([{ type: 'video', kind: 'watch', videoId: 'gta', blocked: true }]);
  });

  it('reports watch verdicts from /next during navigation', async () => {
    const { win, videos } = setup({ '/youtubei/v1/next': f.watchNextFor('ok', 'Woodworking', 'Wood Co', 'x') });
    await win.fetch('/youtubei/v1/next?prettyPrint=false', { method: 'POST', body: '{}' });
    expect(videos()).toEqual([{ type: 'video', kind: 'watch', videoId: 'ok', blocked: false }]);
  });

  it('reports Short verdicts from reel_item_watch', async () => {
    const { win, videos } = setup({ '/reel/reel_item_watch': f.reelItemWatch('s1', 'GTA VI funny moments') });
    await win.fetch('/youtubei/v1/reel/reel_item_watch', { method: 'POST', body: '{}' });
    expect(videos()).toEqual([{ type: 'video', kind: 'short', videoId: 's1', blocked: true }]);
  });

  it('does nothing while filtering is off', async () => {
    const { win, videos } = setup({});
    document.dispatchEvent(
      new CustomEvent('sixbegone:to-main', {
        detail: JSON.stringify({ type: 'settings', settings: { enabled: false } }),
      }),
    );
    const data = f.homeInitialData();
    win.ytInitialData = data;
    expect(JSON.stringify(win.ytInitialData)).toContain('GTA 6 Trailer 3 Breakdown');
    expect(videos()).toEqual([]);
  });
});
