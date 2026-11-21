/**
 * Hooks YouTube's data sources so GTA 6 items are pruned before YouTube
 * renders them. Must run in the MAIN world at document_start, before
 * YouTube's own scripts capture `fetch` or assign `ytInitialData`.
 *
 * Three sources:
 *   1. window.ytInitialData: the first page load's data, assigned by an inline
 *      script. Trapped with an accessor property on window.
 *   2. fetch(): every later navigation, search and infinite-scroll batch
 *      goes to /youtubei/v1/*.
 *   3. XMLHttpRequest: used by some clients (m.youtube.com) for the same
 *      endpoints.
 *
 * Any failure falls back to the untouched original. Filtering must never
 * break YouTube.
 */

/** Endpoints whose responses contain feed items. */
export const FILTERED_ENDPOINTS = /\/youtubei\/v1\/(browse|search|next|get_watch|reel\/reel_watch_sequence)(\?|$)/;

export type Pruner = (data: unknown, source: string) => void;

export function isFilteredUrl(url: string): boolean {
  try {
    return FILTERED_ENDPOINTS.test(new URL(url, location.href).pathname);
  } catch {
    return false;
  }
}

/** Trap a global like ytInitialData so assignments pass through `prune`. */
export function trapGlobal(win: Window, name: string, prune: Pruner): void {
  const desc = Object.getOwnPropertyDescriptor(win, name);
  if (desc && !desc.configurable) return;

  let value: unknown = desc && 'value' in desc ? desc.value : undefined;
  if (value && typeof value === 'object') safePrune(prune, value, name);

  Object.defineProperty(win, name, {
    configurable: true,
    enumerable: true,
    get: () => value,
    set: (next: unknown) => {
      if (next && typeof next === 'object') safePrune(prune, next, name);
      value = next;
    },
  });
}

export function wrapFetch(win: Window, prune: Pruner): void {
  const original = win.fetch;
  if (typeof original !== 'function') return;

  const wrapped = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await original.call(this ?? win, input, init);
    const url = input instanceof Request ? input.url : String(input);
    if (!response.ok || !isFilteredUrl(url)) return response;

    try {
      const data: unknown = await response.clone().json();
      safePrune(prune, data, 'fetch');
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

export function wrapXhr(win: Window, prune: Pruner): void {
  const proto = (win as unknown as typeof globalThis).XMLHttpRequest?.prototype;
  if (!proto) return;

  const textDesc = Object.getOwnPropertyDescriptor(proto, 'responseText');
  const responseDesc = Object.getOwnPropertyDescriptor(proto, 'response');
  if (!textDesc?.get || !responseDesc?.get) return;
  const getText = textDesc.get;
  const getResponse = responseDesc.get;
  const originalOpen = proto.open;

  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    if (isFilteredUrl(String(url))) shadow(this);
    return (originalOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof proto.open;

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
        if (data && typeof data === 'object') safePrune(prune, data, 'xhr');
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

function safePrune(prune: Pruner, data: unknown, source: string) {
  try {
    prune(data, source);
  } catch (err) {
    console.debug('[SixBeGone] filtering skipped:', source, err);
  }
}
