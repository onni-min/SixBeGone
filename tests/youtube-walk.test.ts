import { describe, expect, it } from 'vitest';
import { compileMatcher } from '../src/core/matcher';
import { BUILTIN_RULES } from '../src/core/rules';
import { extractItem, prune } from '../src/sites/youtube/walk';
import * as f from './fixtures/youtube';

const matcher = compileMatcher(BUILTIN_RULES);

/** All video ids left in a tree, in order. */
function ids(data: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const k of ['videoId', 'contentId', 'channelId']) {
        if (typeof o[k] === 'string') out.push(o[k] as string);
      }
      for (const [k, child] of Object.entries(o)) if (k !== 'onTap') visit(child);
      const tap = o.onTap as { innertubeCommand?: { reelWatchEndpoint?: { videoId?: string } } } | undefined;
      const short = tap?.innertubeCommand?.reelWatchEndpoint?.videoId;
      if (short) out.push(short);
    }
  };
  visit(data);
  return out;
}

describe('extractItem', () => {
  it('collects titles, channel names and ids but skips thumbnails, menus and tracking', () => {
    const info = extractItem(f.videoRenderer('x', 'Hello', 'Chan', 'UCabc', '@chan').videoRenderer);
    expect(info.text).toContain('Hello');
    expect(info.text).toContain('Chan');
    expect(info.text).not.toContain('Add to queue');
    expect(info.text.join(' ')).not.toContain('ytimg');
    expect(info.channels.sort()).toEqual(['@chan', 'UCabc']);
  });

  it('reads view-model text', () => {
    const info = extractItem(f.lockupViewModel('x', 'A title', 'A channel', 'UCvm').lockupViewModel);
    expect(info.text).toEqual(expect.arrayContaining(['A title', 'A channel']));
    expect(info.channels).toEqual(['UCvm']);
  });
});

describe('prune: home feed', () => {
  const data = f.homeInitialData();
  const removed = prune(data, matcher);

  it('removes GTA 6 videos in both renderer formats, Shorts and GTA 6 shelves', () => {
    expect(ids(data)).toEqual(['a2', 'a4', 's2']);
    // a1, a3 (view model), s1 (Short), and the "Latest GTA 6 news" shelf (n1)
    expect(removed).toBe(4);
  });

  it('keeps GTA 5, ads, shelves without GTA 6 in the title, and the continuation', () => {
    const grid = data.contents.twoColumnBrowseResultsRenderer.tabs[0]!.tabRenderer.content.richGridRenderer.contents;
    const keys = grid.map((el) => Object.keys(el)[0]);
    expect(keys).toEqual(['richItemRenderer', 'richItemRenderer', 'richItemRenderer', 'richSectionRenderer', 'continuationItemRenderer']);
  });
});

describe('prune: emptied shelves', () => {
  it('drops a shelf whose items were all removed', () => {
    const data = { items: [f.richShelf('Shorts', [f.richItem(f.shortsLockup('z1', 'GTA 6 short'))]), f.continuation()] };
    prune(data, matcher);
    expect(data.items.map((el) => Object.keys(el)[0])).toEqual(['continuationItemRenderer']);
  });
});

describe('prune: watch page', () => {
  it('cleans the sidebar and end screen but leaves the main video info alone', () => {
    const data = f.watchNext();
    prune(data, matcher);
    expect(ids(data)).toEqual(['w2', 'w4', 'e2']);
    expect(data.contents.twoColumnWatchNextResults.results.results.contents).toHaveLength(2);
    expect(data.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results.at(-1)).toHaveProperty(
      'continuationItemRenderer',
    );
  });
});

describe('prune: search', () => {
  it('removes GTA 6 channels, videos and Shorts', () => {
    const data = f.searchResults();
    expect(prune(data, matcher)).toBe(3);
    expect(ids(data)).toEqual(['q2', 'q4']);
  });
});

describe('prune: continuation', () => {
  it('filters infinite-scroll batches', () => {
    const data = f.homeContinuation();
    prune(data, matcher);
    expect(ids(data)).toEqual(['c2']);
  });
});

describe('prune: user settings', () => {
  it('removes everything from a blocked channel by id or handle', () => {
    const m = compileMatcher(BUILTIN_RULES, { customChannels: ['@gtaclips'] });
    const data = {
      items: [
        f.videoRenderer('k1', 'Funny moments compilation', 'GTA Clips', 'UCclips', '@gtaclips'),
        f.videoRenderer('k2', 'Funny moments compilation', 'Other', 'UCother', '@other'),
      ],
    };
    prune(data, m);
    expect(ids(data)).toEqual(['k2']);
  });

  it('allow phrases keep an item', () => {
    const m = compileMatcher(BUILTIN_RULES, { allowTerms: ['patch notes'] });
    const data = { items: [f.videoRenderer('p1', 'GTA 6 patch notes 1.02')] };
    expect(prune(data, m)).toBe(0);
  });
});

describe('prune: robustness', () => {
  it('handles primitives, null and empty structures', () => {
    for (const v of [null, undefined, 0, 'x', [], {}, [[]], { a: null }]) {
      expect(prune(v, matcher)).toBe(0);
    }
  });

  it('leaves unknown element types untouched', () => {
    const data = { items: [{ someFutureRenderer: { title: f.run('GTA 6') } }] };
    // Unknown types are walked into but only known items are removed.
    expect(prune(data, matcher)).toBe(0);
    expect(data.items).toHaveLength(1);
  });

  it('finds items in unexpected places', () => {
    const data = { a: { b: [{ c: { d: [f.videoRenderer('deep', 'GTA 6 deep')] } }] } };
    expect(prune(data, matcher)).toBe(1);
  });

  it('is fast on a large feed', () => {
    const big = {
      items: Array.from({ length: 5000 }, (_, i) =>
        f.richItem(i % 10 === 0 ? f.videoRenderer(`v${i}`, 'GTA 6 clip') : f.lockupViewModel(`v${i}`, `Video ${i}`)),
      ),
    };
    const t = performance.now();
    expect(prune(big, matcher)).toBe(500);
    expect(performance.now() - t).toBeLessThan(500);
  });
});
