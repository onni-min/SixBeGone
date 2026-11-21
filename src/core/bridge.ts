/**
 * Messaging between the two halves of each site integration:
 *
 *   ISOLATED world (bridge content script)  <->  MAIN world (interceptor)
 *
 * The MAIN-world script runs inside the page so it can patch fetch/XHR, but it
 * has no extension APIs. The ISOLATED script reads storage and relays settings
 * in, and relays removal counts out.
 *
 * Payloads travel as JSON strings in CustomEvent.detail: Firefox doesn't let
 * page scripts read objects created in the content-script world, but strings
 * cross fine. The page can see and fake these events. That is acceptable:
 * the worst it can do is change its own filtering or inflate a counter, and
 * nothing sensitive is ever sent.
 */
import type { Settings } from './settings';

const TO_MAIN = 'sixbegone:to-main';
const TO_ISOLATED = 'sixbegone:to-isolated';

export type ToMain = { type: 'settings'; settings: Settings };
export type ToIsolated = { type: 'hello' } | { type: 'removed'; count: number };

function send(name: string, msg: unknown) {
  document.dispatchEvent(new CustomEvent(name, { detail: JSON.stringify(msg) }));
}

function listen<T>(name: string, handler: (msg: T) => void) {
  document.addEventListener(name, (e) => {
    const detail = (e as CustomEvent).detail;
    if (typeof detail !== 'string') return;
    try {
      handler(JSON.parse(detail) as T);
    } catch {
      // Ignore malformed messages.
    }
  });
}

export const sendToMain = (msg: ToMain) => send(TO_MAIN, msg);
export const sendToIsolated = (msg: ToIsolated) => send(TO_ISOLATED, msg);
export const onMainMessage = (h: (m: ToMain) => void) => listen<ToMain>(TO_MAIN, h);
export const onIsolatedMessage = (h: (m: ToIsolated) => void) => listen<ToIsolated>(TO_ISOLATED, h);
