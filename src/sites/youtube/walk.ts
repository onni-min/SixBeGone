/**
 * Generic YouTube JSON pruner.
 *
 * YouTube's InnerTube responses (ytInitialData, /youtubei/v1/browse, search,
 * next, …) are deep trees whose shape changes constantly: renderers are being
 * migrated to view models and A/B tests move things around. So instead of
 * hardcoding paths, this walks every array in the tree, recognizes elements
 * that are a single piece of content (a video card, a Short, a playlist, a
 * post…), scores the text inside it, and removes it from the array if it
 * matches. Shelves (rows with a heading) are removed whole when the heading
 * matches, otherwise their contents are walked.
 *
 * Removing whole array elements, rather than editing fields, keeps the
 * structure YouTube expects: a feed with one fewer card.
 */
import type { Matcher } from '../../core/matcher';

/** Keys of array elements that are one piece of content. */
export const ITEM_KEYS = new Set([
  // Video cards
  'videoRenderer',
  'compactVideoRenderer',
  'gridVideoRenderer',
  'videoWithContextRenderer',
  'playlistVideoRenderer',
  'playlistPanelVideoRenderer',
  'watchCardCompactVideoRenderer',
  'endScreenVideoRenderer',
  'richGridMedia',
  'movieRenderer',
  // View models (the newer format)
  'lockupViewModel',
  'shortsLockupViewModel',
  'shortsLockupViewModelV2',
  // Shorts (older format)
  'reelItemRenderer',
  // Playlists and mixes
  'playlistRenderer',
  'gridPlaylistRenderer',
  'compactPlaylistRenderer',
  'radioRenderer',
  'compactRadioRenderer',
  // Community posts
  'backstagePostThreadRenderer',
  'backstagePostRenderer',
  'postRenderer',
  'sharedPostRenderer',
  // Channels in search results (e.g. a "GTA 6 News" channel)
  'channelRenderer',
  'gridChannelRenderer',
  // Comments. The older format has the text inline; the newer
  // commentViewModel only holds a commentId, and the text sits in a
  // commentEntityPayload under frameworkUpdates (see buildCommentLookup).
  'commentThreadRenderer',
  'commentRenderer',
  'commentViewModel',
]);

/** Wrappers whose `content` holds one item (home grid, channel grids). */
const WRAPPER_KEYS = new Set(['richItemRenderer']);

/** Rows with a heading. Removed whole if the heading matches. */
const SHELF_KEYS = new Set([
  'shelfRenderer',
  'richShelfRenderer',
  'reelShelfRenderer',
  'horizontalCardListRenderer',
  'gridShelfViewModel',
]);

/** Shelf fields that make up its heading. */
const SHELF_HEADING_KEYS = ['title', 'subtitle', 'header', 'headerRenderer'];

/** Keys whose string values are human-readable text. */
const TEXT_KEYS = new Set(['text', 'simpleText', 'content', 'title', 'accessibilityText', 'label', 'headline']);

/** Subtrees that never contain useful text and are expensive to walk. */
const SKIP_KEYS = new Set([
  'thumbnail',
  'thumbnails',
  'thumbnailOverlays',
  'trackingParams',
  'clickTrackingParams',
  'loggingDirectives',
  'menu',
  'contentImage',
  'image',
  'icon',
  'rendererContext',
  'commandContext',
]);

const MAX_TEXT_CHARS = 4000;
const MAX_DEPTH = 40;

export interface ItemInfo {
  text: string[];
  channels: string[];
}

/** Text and author of comments in the newer format, keyed by commentId. */
export type CommentLookup = Map<string, ItemInfo>;

/** Collect readable text and channel identifiers from one item. */
export function extractItem(node: unknown, comments?: CommentLookup): ItemInfo {
  const text: string[] = [];
  const channels = new Set<string>();
  let chars = 0;

  const visit = (value: unknown, key: string, depth: number) => {
    if (depth > MAX_DEPTH || chars > MAX_TEXT_CHARS) return;
    if (typeof value === 'string') {
      if (TEXT_KEYS.has(key) && value.trim()) {
        text.push(value);
        chars += value.length;
      } else if ((key === 'browseId' || key === 'channelId') && value.startsWith('UC')) {
        channels.add(value);
      } else if (key === 'canonicalBaseUrl' && value.startsWith('/@')) {
        channels.add(value.slice(1));
      } else if (key === 'commentId' && comments) {
        const c = comments.get(value);
        if (c) {
          text.push(...c.text);
          c.channels.forEach((ch) => channels.add(ch));
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) visit(v, key, depth + 1);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        // A thread is judged on its own comment, not on its replies.
        if (!SKIP_KEYS.has(k) && k !== 'replies') visit(v, k, depth + 1);
      }
    }
  };

  visit(node, '', 0);
  return { text, channels: [...channels] };
}

/**
 * Find every commentEntityPayload in the response and index its text and
 * author by commentId, so a commentViewModel (which holds only the id) can
 * be judged on what the comment says.
 */
export function buildCommentLookup(data: unknown): CommentLookup {
  const lookup: CommentLookup = new Map();
  const visit = (value: unknown, depth: number) => {
    if (depth > MAX_DEPTH * 4 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const v of value) visit(v, depth + 1);
      return;
    }
    const obj = value as Record<string, unknown>;
    const payload = obj.commentEntityPayload as
      | { properties?: { commentId?: unknown; content?: { content?: unknown } }; author?: { displayName?: unknown; channelId?: unknown } }
      | undefined;
    const id = payload?.properties?.commentId;
    if (typeof id === 'string') {
      const text = [payload?.properties?.content?.content, payload?.author?.displayName].filter(
        (t): t is string => typeof t === 'string' && t.length > 0,
      );
      const ch = payload?.author?.channelId;
      lookup.set(id, { text, channels: typeof ch === 'string' ? [ch] : [] });
      return;
    }
    for (const [k, v] of Object.entries(obj)) if (!SKIP_KEYS.has(k)) visit(v, depth + 1);
  };
  visit(data, 0);
  return lookup;
}

function isBlocked(info: ItemInfo, matcher: Matcher): boolean {
  if (info.channels.some((c) => matcher.isBlockedChannel(c))) return true;
  return info.text.length > 0 && matcher.match(...info.text).blocked;
}

/** The single meaningful key of an array element, e.g. "videoRenderer". */
function elementKey(el: Record<string, unknown>): string | undefined {
  for (const k of Object.keys(el)) {
    if (k !== 'trackingParams' && k !== 'clickTrackingParams') return k;
  }
  return undefined;
}

type Verdict = 'remove' | 'keep' | 'descend';

function judge(el: unknown, matcher: Matcher, comments: CommentLookup): Verdict {
  if (!el || typeof el !== 'object' || Array.isArray(el)) return 'descend';
  const obj = el as Record<string, unknown>;
  const key = elementKey(obj);
  if (!key) return 'descend';

  if (ITEM_KEYS.has(key)) {
    if (isBlocked(extractItem(obj[key], comments), matcher)) return 'remove';
    // A comment thread that stays may hold replies loaded inline.
    return key === 'commentThreadRenderer' ? 'descend' : 'keep';
  }

  if (WRAPPER_KEYS.has(key)) {
    const content = (obj[key] as { content?: Record<string, unknown> } | undefined)?.content;
    const inner = content && elementKey(content);
    if (inner && ITEM_KEYS.has(inner)) {
      return isBlocked(extractItem(content[inner], comments), matcher) ? 'remove' : 'keep';
    }
    return 'descend';
  }

  // richSectionRenderer { content: { richShelfRenderer } } and plain shelves.
  const shelf = shelfOf(obj, key);
  if (shelf) {
    const heading = SHELF_HEADING_KEYS.map((k) => shelf[k]).filter(Boolean);
    if (heading.length && isBlocked(extractItem(heading), matcher)) return 'remove';
  }
  return 'descend';
}

function shelfOf(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  if (SHELF_KEYS.has(key)) return obj[key] as Record<string, unknown>;
  if (key === 'richSectionRenderer') {
    const content = (obj[key] as { content?: Record<string, unknown> } | undefined)?.content;
    const inner = content && elementKey(content);
    if (inner && SHELF_KEYS.has(inner)) return content[inner] as Record<string, unknown>;
  }
  return undefined;
}

function isEmptiedShelf(el: unknown): boolean {
  if (!el || typeof el !== 'object' || Array.isArray(el)) return false;
  const obj = el as Record<string, unknown>;
  const key = elementKey(obj);
  const shelf = key && shelfOf(obj, key);
  if (!shelf) return false;
  const lists = ['contents', 'items'].map((k) => shelf[k]).filter(Array.isArray);
  return lists.length > 0 && lists.every((l) => l.length === 0);
}

/**
 * Remove matching content from `data` in place. Returns how many items were
 * removed. Safe to call on any JSON value.
 */
export function prune(data: unknown, matcher: Matcher): number {
  let removed = 0;
  const comments = buildCommentLookup(data);

  const walk = (value: unknown, depth: number) => {
    if (depth > MAX_DEPTH * 4 || !value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      let write = 0;
      for (let read = 0; read < value.length; read++) {
        const el = value[read];
        const verdict = judge(el, matcher, comments);
        if (verdict === 'remove') {
          removed++;
          continue;
        }
        if (verdict === 'descend') {
          walk(el, depth + 1);
          // A shelf we emptied would leave a bare heading behind.
          if (isEmptiedShelf(el)) continue;
        }
        value[write++] = el;
      }
      value.length = write;
      return;
    }

    for (const [k, v] of Object.entries(value)) {
      if (!SKIP_KEYS.has(k)) walk(v, depth + 1);
    }
  };

  walk(data, 0);
  return removed + pruneAutoplay(data, matcher);
}

/**
 * Stop autoplay from rolling into a GTA 6 video. The watch-next response
 * names the next video in playerOverlayAutoplayRenderer (title, channel) and
 * queues it in twoColumnWatchNextResults.autoplay. When the next video
 * matches, both are removed, so the video simply ends.
 */
export function pruneAutoplay(data: unknown, matcher: Matcher): number {
  let blocked = false;
  const findOverlay = (value: unknown, depth: number) => {
    if (blocked || depth > MAX_DEPTH * 4 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach((v) => findOverlay(v, depth + 1));
    const obj = value as Record<string, unknown>;
    if (obj.playerOverlayAutoplayRenderer && typeof obj.playerOverlayAutoplayRenderer === 'object') {
      if (isBlocked(extractItem(obj.playerOverlayAutoplayRenderer), matcher)) {
        delete obj.playerOverlayAutoplayRenderer;
        blocked = true;
      }
      return;
    }
    for (const [k, v] of Object.entries(obj)) if (!SKIP_KEYS.has(k)) findOverlay(v, depth + 1);
  };
  findOverlay(data, 0);
  if (!blocked) return 0;

  const results = (data as { contents?: { twoColumnWatchNextResults?: Record<string, unknown> } })?.contents
    ?.twoColumnWatchNextResults;
  if (results && 'autoplay' in results) delete results.autoplay;
  return 1;
}

export interface VideoInfo {
  videoId: string;
  title: string;
  channel?: string;
  channelId?: string;
}

/**
 * Which video a watch-page response is for: from ytInitialData or a
 * /next or /get_watch response. Only the title and channel are used to
 * decide, not the description or tags: creators often stuff "GTA 6" into
 * tags and descriptions of unrelated videos.
 */
export function extractWatchInfo(data: unknown): VideoInfo | undefined {
  const responses = Array.isArray(data) ? data : [data];
  for (const r of responses) {
    const root = r as Record<string, any> | undefined;
    if (!root || typeof root !== 'object') continue;
    const videoId: unknown = root.currentVideoEndpoint?.watchEndpoint?.videoId;
    const contents: unknown[] = root.contents?.twoColumnWatchNextResults?.results?.results?.contents ?? [];
    let title: string | undefined;
    let channel: string | undefined;
    let channelId: string | undefined;
    for (const el of contents as Array<Record<string, any>>) {
      const primary = el?.videoPrimaryInfoRenderer;
      if (primary) title = runsText(primary.title);
      const owner = el?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;
      if (owner) {
        channel = runsText(owner.title);
        channelId = owner.navigationEndpoint?.browseEndpoint?.browseId;
      }
    }
    if (typeof videoId === 'string' && title) return { videoId, title, channel, channelId };
  }
  return undefined;
}

/**
 * Which Short a /reel/reel_item_watch response is for, and its text. The
 * videoId comes from the response or, failing that, from the request body.
 */
export function extractShortInfo(data: unknown, requestBody?: string): (ItemInfo & { videoId: string }) | undefined {
  const root = data as Record<string, any> | undefined;
  if (!root || typeof root !== 'object') return undefined;
  let videoId: unknown = root.replacementEndpoint?.reelWatchEndpoint?.videoId;
  if (typeof videoId !== 'string' && requestBody) {
    try {
      const body = JSON.parse(requestBody);
      videoId = body?.playerRequest?.videoId ?? body?.videoId;
    } catch {
      // Not JSON.
    }
  }
  if (typeof videoId !== 'string') return undefined;
  const info = extractItem(root.overlay ?? root);
  return { videoId, ...info };
}

function runsText(t: unknown): string | undefined {
  const o = t as { simpleText?: string; runs?: Array<{ text?: string }> } | undefined;
  if (!o) return undefined;
  if (typeof o.simpleText === 'string') return o.simpleText;
  const s = o.runs?.map((r) => r.text ?? '').join('');
  return s || undefined;
}
