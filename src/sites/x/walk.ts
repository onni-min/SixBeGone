/**
 * Prunes X (Twitter) GraphQL responses.
 *
 * Timelines are lists of entries (`entries`), and conversation modules hold
 * their tweets in `items` / `moduleItems`. Paths differ per endpoint
 * (home_timeline_urt, threaded_conversation_with_injections_v2,
 * search_by_raw_query…) and change between deploys, so instead of fixed
 * paths this walks the whole response, treats every element of those three
 * array kinds as an entry, and judges it by the tweets and trends inside it.
 *
 * Entries are recognized by what they contain, never by entryId prefix
 * (X names them per surface and adds new ones without notice). Entries with
 * nothing to judge (cursors, "who to follow") are always kept, which keeps
 * pagination working.
 *
 * Approach informed by MrOplus/x-interceptor (no license; read only). The
 * code here is our own.
 */
import type { Matcher } from '../../core/matcher';

const PRUNABLE = new Set(['entries', 'items', 'moduleItems']);
const MAX_DEPTH = 80;

export interface Judged {
  kind: 'tweet' | 'trend';
  text: string[];
  authors: string[];
}

/** Text and authors of one Tweet node (not its quoted or retweeted tweet). */
export function tweetInfo(node: Record<string, any>): Judged {
  const legacy = node.legacy ?? {};
  const user = node.core?.user_results?.result ?? {};
  const text: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) text.push(v);
  };

  // note_tweet holds the full body of long posts; full_text is cut at 280.
  // Since X's late-2026 redesign the text sits in `details`, not `legacy`.
  push(node.note_tweet?.note_tweet_results?.result?.text ?? node.details?.full_text ?? legacy.full_text);
  const media = [
    ...(node.media_entities2 ?? []),
    ...(legacy.extended_entities?.media ?? legacy.entities?.media ?? []),
  ];
  for (const m of media) push(m?.ext_alt_text);
  // Link preview cards (article title/description).
  for (const b of node.card?.legacy?.binding_values ?? []) {
    if (['title', 'description'].includes(b?.key)) push(b?.value?.string_value);
  }
  // Newer payloads moved name/screen_name to user.core; older keep them in legacy.
  const name = user.core?.name ?? user.legacy?.name;
  const screenName = user.core?.screen_name ?? user.legacy?.screen_name;
  push(name);

  const authors = [screenName, user.rest_id].filter((a): a is string => typeof a === 'string');
  return { kind: 'tweet', text, authors };
}

/** Text of a trend (Explore page, "What's happening" sidebar). */
function trendInfo(node: Record<string, any>): Judged {
  const text = [node.name, node.trend_metadata?.domain_context, node.trend_metadata?.meta_description].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  );
  return { kind: 'trend', text, authors: [] };
}

/** Every tweet and trend inside a subtree. */
export function collect(node: unknown): Judged[] {
  const out: Judged[] = [];
  const visit = (v: unknown, depth: number) => {
    if (!v || typeof v !== 'object' || depth > MAX_DEPTH) return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    const o = v as Record<string, any>;
    if (o.__typename === 'Tweet' && (o.legacy || o.note_tweet || o.details)) out.push(tweetInfo(o));
    else if (o.__typename === 'TimelineTrend' && typeof o.name === 'string') out.push(trendInfo(o));
    // AI-written news stories in the sidebar and Explore ("Today's News").
    else if (o.__typename === 'AiTrend' && typeof o.core?.name === 'string') {
      out.push({ kind: 'trend', text: [o.core.name, o.core.category].filter((t) => typeof t === 'string'), authors: [] });
    }
    // TweetWithVisibilityResults wraps the tweet in `.tweet`; quoted and
    // retweeted tweets are nested Tweet nodes. Walking everything finds all.
    for (const x of Object.values(o)) visit(x, depth + 1);
  };
  visit(node, 0);
  return out;
}

function blocked(j: Judged, matcher: Matcher): boolean {
  return j.authors.some((a) => matcher.isBlockedChannel(a)) || (j.text.length > 0 && matcher.match(...j.text).blocked);
}

function threadStartBlocked(entry: unknown, matcher: Matcher): boolean {
  const e = entry as { content?: { items?: unknown[] }; items?: unknown[] } | undefined;
  const items = e?.content?.items ?? e?.items;
  if (!Array.isArray(items) || items.length < 2) return false;
  // Only conversations: a trends list keeps its other trends.
  const first = collect(items[0]);
  return first.length > 0 && first.every((j) => j.kind === 'tweet') && first.some((j) => blocked(j, matcher));
}

/** Remove matching entries from `data` in place. Returns how many were removed. */
export function prune(data: unknown, matcher: Matcher): number {
  let removed = 0;

  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'instructions' && Array.isArray(value)) {
        // A pinned post arrives as its own instruction ({ type:
        // 'TimelinePinEntry', entry }) rather than inside `entries`.
        let write = 0;
        for (const inst of value) {
          const entry = (inst as { entry?: unknown } | null)?.entry;
          if (entry && collect(entry).some((j) => blocked(j, matcher))) {
            removed++;
            continue;
          }
          walk(inst, depth + 1);
          value[write++] = inst;
        }
        value.length = write;
        continue;
      }
      if (!PRUNABLE.has(key) || !Array.isArray(value)) {
        walk(value, depth + 1);
        continue;
      }
      let write = 0;
      for (const entry of value) {
        // A thread whose opening tweet matches goes whole; its replies would
        // be orphans (and are usually about the same thing).
        if (threadStartBlocked(entry, matcher)) {
          removed++;
          continue;
        }
        const before = collect(entry).length;
        // Depth-first: prune a module's own items first, so one GTA 6 reply
        // costs that reply and not the whole thread.
        walk(entry, depth + 1);
        const inside = collect(entry);
        if (inside.length === 0) {
          // Nothing to judge from the start (cursor, user module): keep.
          // Emptied by the pass above: drop, or it renders as a blank card.
          if (before === 0) value[write++] = entry;
          continue;
        }
        if (inside.some((j) => blocked(j, matcher))) {
          removed++;
          continue;
        }
        value[write++] = entry;
      }
      value.length = write;
    }
  };

  walk(data, 0);
  return removed;
}

/** `/i/api/graphql/<queryId>/<OperationName>`: the queryId rotates, the name doesn't. */
export function operationName(url: string): string | undefined {
  try {
    const parts = new URL(url, 'https://x.com').pathname.split('/');
    const i = parts.indexOf('graphql');
    return i >= 0 ? parts[i + 2] || undefined : undefined;
  } catch {
    return undefined;
  }
}

/**
 * GraphQL operations that only write (posting, liking, following…). Their
 * responses are left alone. Everything else is pruned, so new timeline
 * operations are covered without code changes. Older names start with a
 * verb (CreateTweet); since the redesign they end in "Mutation".
 */
const WRITE_OPERATIONS =
  /^(Create|Delete|Favorite|Unfavorite|Follow|Unfollow|Mute|Unmute|Block|Unblock|Pin|Unpin|Update|Remove|Add)|Mutation$/;

/** Hosts X serves its API from: x.com/i/api/… before the redesign, api.x.com after. */
const X_API_HOSTS = new Set(['x.com', 'api.x.com', 'twitter.com', 'api.twitter.com', 'mobile.x.com']);

export function isFilteredXUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url, 'https://x.com');
  } catch {
    return false;
  }
  if (!X_API_HOSTS.has(u.hostname)) return false;
  if (u.pathname.startsWith('/i/api/2/guide.json')) return true; // trends (older REST)
  // /i/api/graphql/<id>/<Op> (old) or /graphql/<id>/<Op> on api.x.com (new).
  if (!/^\/(i\/api\/)?graphql\/[^/]+\/[^/]+/.test(u.pathname)) return false;
  const op = operationName(url);
  return !!op && !WRITE_OPERATIONS.test(op);
}
