import { describe, expect, it } from 'vitest';
import { compileMatcher } from '../src/core/matcher';
import { BUILTIN_RULES } from '../src/core/rules';
import { buildCommentLookup, extractShortInfo, extractWatchInfo, prune } from '../src/sites/youtube/walk';
import * as f from './fixtures/youtube';

const matcher = compileMatcher(BUILTIN_RULES);

const commentIds = (data: unknown): string[] =>
  [...JSON.stringify(data).matchAll(/"commentViewModel":\{"commentId":"(\w+)"|"commentId":"(\w+)","commentKey"/g)].map(
    (m) => m[1] ?? m[2]!,
  );

describe('comments', () => {
  it('indexes comment entities by id', () => {
    const lookup = buildCommentLookup(f.commentsContinuation());
    expect(lookup.get('r1')?.text).toContain('yes, GTA 6 ending was wild');
    expect(lookup.get('t1')?.channels).toEqual(['UCviewer']);
  });

  it('removes new-format threads and replies by their text, and old-format comments', () => {
    const data = f.commentsContinuation();
    expect(prune(data, matcher)).toBe(3); // t3, r1, old-format
    expect(commentIds(data)).toEqual(['t1', 't2', 'r2']);
  });

  it('keeps a thread when only a reply matches', () => {
    const data = f.commentsContinuation();
    prune(data, matcher);
    expect(JSON.stringify(data)).toContain('"commentId":"t2"');
  });

  it('removes comments by a blocked author', () => {
    const m = compileMatcher(BUILTIN_RULES, { customChannels: ['UCviewer'] });
    const data = f.commentsContinuation();
    prune(data, m);
    expect(commentIds(data)).toEqual([]);
  });
});

describe('autoplay', () => {
  it('removes autoplay when the next video is GTA 6', () => {
    const data = f.watchNextFor('v1', 'Woodworking basics', 'Wood Co', 'GTA 6 full story recap');
    prune(data, matcher);
    expect(data.contents.twoColumnWatchNextResults).not.toHaveProperty('autoplay');
    expect(data.playerOverlays.playerOverlayRenderer.autoplay).not.toHaveProperty('playerOverlayAutoplayRenderer');
  });

  it('leaves autoplay alone otherwise', () => {
    const data = f.watchNextFor('v1', 'Woodworking basics', 'Wood Co', 'Sanding tips');
    expect(prune(data, matcher)).toBe(0);
    expect(data.contents.twoColumnWatchNextResults).toHaveProperty('autoplay');
  });
});

describe('extractWatchInfo', () => {
  it('reads the current video id, title and channel', () => {
    expect(extractWatchInfo(f.watchNextFor('abc', 'GTA 6 Trailer 3', 'Rockstar Games', 'x'))).toEqual({
      videoId: 'abc',
      title: 'GTA 6 Trailer 3',
      channel: 'Rockstar Games',
      channelId: 'UCowner',
    });
  });

  it('handles get_watch arrays and non-watch data', () => {
    expect(extractWatchInfo([{}, f.watchNextFor('abc', 'T', 'C', 'x')])?.videoId).toBe('abc');
    expect(extractWatchInfo(f.homeInitialData())).toBeUndefined();
    expect(extractWatchInfo(null)).toBeUndefined();
  });
});

describe('extractShortInfo', () => {
  it('reads the Short id and overlay text', () => {
    const info = extractShortInfo(f.reelItemWatch('s9', '#gta6 secret'));
    expect(info?.videoId).toBe('s9');
    expect(matcher.match(...info!.text).blocked).toBe(true);
  });

  it('falls back to the request body for the id', () => {
    const data = { overlay: { reelPlayerOverlayRenderer: { reelTitleText: f.run('cats') } } };
    expect(extractShortInfo(data, JSON.stringify({ playerRequest: { videoId: 'b1' } }))?.videoId).toBe('b1');
    expect(extractShortInfo(data, 'not json')).toBeUndefined();
  });
});
