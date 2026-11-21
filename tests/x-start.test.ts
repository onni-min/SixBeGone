import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFilterState } from '../src/core/filter-state';
import { startX } from '../src/sites/x';
import * as f from './fixtures/x';

beforeEach(() => {
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('location', new URL('https://x.com/home'));
});

describe('startX', () => {
  it('prunes timeline GraphQL responses and leaves writes alone', async () => {
    const body = { entries: [f.tweetEntry(f.tweet('1', 'GTA 6!!')), f.tweetEntry(f.tweet('2', 'hi'))] };
    const win = { fetch: vi.fn(async () => new Response(JSON.stringify(body))) } as unknown as Window;
    startX(createFilterState(), win);

    const timeline = await (await win.fetch('/i/api/graphql/q/HomeTimeline?variables=%7B%7D')).json();
    expect(timeline.entries).toHaveLength(1);

    const write = await (await win.fetch('/i/api/graphql/q/CreateTweet', { method: 'POST', body: '{}' })).json();
    expect(write.entries).toHaveLength(2);
  });
});
