import { describe, expect, it } from 'vitest';
import { buildMatcher } from '../src/core/rules';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { isFilteredXUrl, prune } from '../src/sites/x/walk';
import * as f from './fixtures/x';

// Regression tests for X's late-2026 redesign (reported: a quote post of
// "In GTA 6 you can literally do zone 2 cardio" on @bryan_johnson's profile
// got through with strict mode on).

const matcher = buildMatcher(DEFAULT_SETTINGS);
const ids = (data: unknown): string[] => {
  const out: string[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (o.__typename === 'Tweet') out.push(o.rest_id as string);
      if (o.__typename === 'AiTrend') out.push(o.rest_id as string);
      Object.values(o).forEach(visit);
    }
  };
  visit(data);
  return out;
};

describe('X redesign responses', () => {
  it('prunes profile posts with text in details, quoted posts, and pinned posts', () => {
    const data = f.profileTimeline2026();
    expect(prune(data, matcher)).toBe(3); // pinned p, 1 (+ quoted 10), 3 (quoted 30)
    expect(ids(data)).toEqual(['2']);
    const instructions = data.data.user_result_by_screen_name.result.profile_user_originals_timeline.timeline.instructions;
    expect(instructions).toHaveLength(1);
    expect(JSON.stringify(instructions)).toContain('cursor-bottom-1');
  });

  it('prunes AI news stories', () => {
    const data = f.newsSidebar2026();
    prune(data, matcher);
    expect(ids(data)).toEqual(['a2']);
  });

  it.each([
    ['https://api.x.com/graphql/abc/UserOriginalsTimeline?variables=%7B%7D', true],
    ['https://api.x.com/graphql/abc/HomeTimeline', true],
    ['https://api.x.com/graphql/abc/explorePageQuery', true],
    ['https://api.x.com/graphql/abc/genericTimelineQuery', true],
    ['https://api.x.com/graphql/abc/newsSidebarQuery', true],
    ['https://api.x.com/graphql/abc/usePremiumPaywallOnLoadMutation', false],
    ['https://api.x.com/1.1/graphql/viewer_context.json', false],
    ['https://api.x.com/1.1/hashflags.json', false],
    ['https://evil.example/graphql/abc/HomeTimeline', false],
  ])('URL filter: %s -> %s', (url, expected) => {
    expect(isFilteredXUrl(url)).toBe(expected);
  });
});
