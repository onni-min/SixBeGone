/**
 * Generic hooks that let a site integration prune JSON before the page sees
 * it. Must run in the MAIN world at document_start, before the site's own
 * scripts capture `fetch` or assign their initial-data globals.
 *
 *   - trapGlobal: an accessor on window for data assigned by inline scripts
 *     (YouTube's ytInitialData)
 *   - wrapFetch / wrapXhr: JSON responses from URLs the site cares about
 *
 * Any failure falls back to the untouched original. Filtering must never
 * break the site.
 */

export interface PruneContext {
  /** 'ytInitialData', 'fetch' or 'xhr'. */
  source: string;
  /** Request URL, for network responses. */
  url?: string;
  /** Request body when it was a string (InnerTube sends JSON). */
  body?: string;
}

export type Pruner = (data: unknown, ctx: PruneContext) => void;

/** Decides which request URLs get their responses pruned. */
export type UrlFilter = (url: string) => boolean;

/** UrlFilter from a regular expression tested against the URL's path. */
export function pathFilter(re: RegExp): UrlFilter {
  return (url) => {
    try {
      return re.test(new URL(url, location.href).pathname);
    } catch {
      return false;
    }
  };
}

/** Trap a global like ytInitialData so assignments pass through `prune`. */
export function trapGlobal(win: Window, name: string, prune: Pruner): void {
  const desc = Object.getOwnPropertyDescriptor(win, name);
  if (desc && !desc.configurable) return;

  let value: unknown = desc && 'value' in desc ? desc.value : undefined;
  if (value && typeof value === 'object') safePrune(prune, value, { source: name });

  Object.defineProperty(win, name, {
    configurable: true,
    enumerable: true,
    get: () => value,
    set: (next: unknown) => {
      if (next && typeof next === 'object') safePrune(prune, next, { source: name });
      value = next;
    },
  });
}

export function wrapFetch(win: Window, prune: Pruner, isFilteredUrl: UrlFilter): void {
  const original = win.fetch;
  if (typeof original !== 'function') return;

  const wrapped = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await original.call(this ?? win, input, init);
    const url = input instanceof Request ? input.url : String(input);
    if (!response.ok || !isFilteredUrl(url)) return response;

    try {
      const data: unknown = await response.clone().json();
      const body = typeof init?.body === 'string' ? init.body : undefined;
      safePrune(prune, data, { source: 'fetch', url, body });
      const filtered = new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      // new Response() has an empty url; keep the original for anything that reads it.
      Object.defineProperty(filtered, 'url', { value: response.url });
      return filtered;
    } catch {
      return response;
    }
  };

  win.fetch = wrapped as typeof fetch;
}

export function wrapXhr(win: Window, prune: Pruner, isFilteredUrl: UrlFilter): void {
  const proto = (win as unknown as typeof globalThis).XMLHttpRequest?.prototype;
  if (!proto) return;

  const textDesc = Object.getOwnPropertyDescriptor(proto, 'responseText');
  const responseDesc = Object.getOwnPropertyDescriptor(proto, 'response');
  if (!textDesc?.get || !responseDesc?.get) return;
  const getText = textDesc.get;
  const getResponse = responseDesc.get;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const bodies = new WeakMap<XMLHttpRequest, string>();
  const urls = new WeakMap<XMLHttpRequest, string>();

  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    if (isFilteredUrl(String(url))) {
      urls.set(this, String(url));
      shadow(this);
    }
    return (originalOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof proto.open;

  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    if (typeof body === 'string' && urls.has(this)) bodies.set(this, body);
    return originalSend.call(this, body);
  };

  // Shadow responseText/response on the instance. A `load` listener would run
  // too late: YouTube's own handlers may read the response first.
  function shadow(xhr: XMLHttpRequest) {
    let cached: { text: string; data: unknown } | undefined;

    const filtered = (): { text: string; data: unknown } | undefined => {
      if (xhr.readyState !== 4) return undefined;
      if (cached) return cached;
      try {
        const type = xhr.responseType;
        const data: unknown =
          type === 'json' ? getResponse.call(xhr) : JSON.parse(getText.call(xhr) as string);
        if (data && typeof data === 'object') {
          safePrune(prune, data, { source: 'xhr', url: urls.get(xhr), body: bodies.get(xhr) });
        }
        cached = { text: JSON.stringify(data), data };
      } catch {
        cached = undefined;
      }
      return cached;
    };

    Object.defineProperty(xhr, 'responseText', {
      configurable: true,
      get() {
        const type = xhr.responseType;
        if (type !== '' && type !== 'text') return getText.call(xhr);
        return filtered()?.text ?? getText.call(xhr);
      },
    });
    Object.defineProperty(xhr, 'response', {
      configurable: true,
      get() {
        const type = xhr.responseType;
        if (type === 'json') return filtered()?.data ?? getResponse.call(xhr);
        if (type === '' || type === 'text') return filtered()?.text ?? getResponse.call(xhr);
        return getResponse.call(xhr);
      },
    });
  }
}

function safePrune(prune: Pruner, data: unknown, ctx: PruneContext) {
  try {
    prune(data, ctx);
  } catch (err) {
    console.debug('[SixBeGone] filtering skipped:', ctx.source, err);
  }
}
