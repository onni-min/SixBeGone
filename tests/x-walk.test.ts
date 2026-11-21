import { describe, expect, it } from 'vitest';
import { buildMatcher } from '../src/core/rules';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { collect, isFilteredXUrl, operationName, prune } from '../src/sites/x/walk';
import * as f from './fixtures/x';

const matcher = buildMatcher(DEFAULT_SETTINGS);

/** Ids of all tweets and trend names left. */
const left = (data: unknown): string[] => {
  const out: string[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (o.__typename === 'Tweet') out.push(o.rest_id as string);
      if (o.__typename === 'TimelineTrend') out.push(o.name as string);
      Object.values(o).forEach(visit);
    }
  };
  visit(data);
  return out;
};

const entryIds = (data: ReturnType<typeof f.homeTimeline>) =>
  data.data.home.home_timeline_urt.instructions[0]!.entries.map((e) => e.entryId);

describe('X home timeline', () => {
  const data = f.homeTimeline();
  const removed = prune(data, matcher);

  it('removes GTA 6 tweets, long posts, quotes, retweets, link cards and image alt text', () => {
    expect(left(data)).toEqual(['2', '8', '90', '92']);
    // entries 1, 3, 4, 5, 6, 7; reply 91; thread c2 (its opening tweet matches)
    expect(removed).toBe(8);
  });

  it('keeps cursors, user modules and the rest of a thread', () => {
    expect(entryIds(data)).toEqual([
      'tweet-2',
      'tweet-8',
      'who-to-follow-1',
      'home-conversation-c1',
      'cursor-top-123',
      'cursor-bottom-123',
    ]);
  });
});

describe('X threads and trends', () => {
  it('removes matching replies added to a conversation', () => {
    const data = f.tweetDetailReplies();
    expect(prune(data, matcher)).toBe(1);
    expect(left(data)).toEqual(['201']);
  });

  it('removes GTA 6 trends', () => {
    const data = f.exploreTrends();
    prune(data, matcher);
    expect(left(data)).toEqual(['Champions League']);
  });
});

describe('X options', () => {
  it('removes everything from a blocked account', () => {
    const m = buildMatcher({ ...DEFAULT_SETTINGS, customChannels: ['@Leaker'] });
    const data = { entries: [f.tweetEntry(f.tweet('1', 'hi', 'leaker')), f.tweetEntry(f.tweet('2', 'hi', 'other'))] };
    prune(data, m);
    expect(left(data)).toEqual(['2']);
  });

  it('strict mode removes GTA 5 too', () => {
    const m = buildMatcher({ ...DEFAULT_SETTINGS, strict: true });
    const data = { entries: [f.tweetEntry(f.tweet('1', 'GTA 5 Online is still fun')), f.tweetEntry(f.tweet('2', 'cats'))] };
    prune(data, m);
    expect(left(data)).toEqual(['2']);
  });
});

describe('collect', () => {
  it('finds nested quoted and retweeted tweets', () => {
    const t = f.tweet('1', 'x', 'a', { quoted_status_result: { result: f.tweet('2', 'y', 'b') } });
    expect(collect(t).map((j) => j.authors[0])).toEqual(['a', 'b']);
  });

  it('handles junk', () => {
    for (const v of [null, 1, 'x', [], {}]) expect(prune(v, matcher)).toBe(0);
  });
});

describe('URL filter', () => {
  it.each([
    ['https://x.com/i/api/graphql/abc123/HomeTimeline?variables=%7B%7D', true],
    ['/i/api/graphql/zzz/TweetDetail', true],
    ['/i/api/graphql/zzz/SearchTimeline', true],
    ['/i/api/graphql/zzz/SomeNewTimeline', true],
    ['/i/api/graphql/zzz/CreateTweet', false],
    ['/i/api/graphql/zzz/FavoriteTweet', false],
    ['/i/api/2/guide.json?include_profile_interstitial_type=1', true],
    ['/i/api/1.1/jot/client_event.json', false],
    ['https://abs.twimg.com/responsive-web/client-web/main.js', false],
  ])('%s -> %s', (url, expected) => {
    expect(isFilteredXUrl(url)).toBe(expected);
  });

  it('reads the operation name', () => {
    expect(operationName('/i/api/graphql/q1d/HomeLatestTimeline')).toBe('HomeLatestTimeline');
    expect(operationName('/home')).toBeUndefined();
  });
});
