import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onIsolatedMessage, sendToMain, type ToIsolated } from '../src/core/bridge';
import { createFilterState } from '../src/core/filter-state';
import { DEFAULT_SETTINGS } from '../src/core/settings';

// Node has EventTarget and CustomEvent; a bare EventTarget stands in for document.
beforeEach(() => {
  vi.stubGlobal('document', new EventTarget());
});

describe('bridge + filter state', () => {
  it('filters with built-in rules before settings arrive', () => {
    const state = createFilterState();
    expect(state.active).toBe(true);
    expect(state.matcher.match('GTA 6 trailer').blocked).toBe(true);
  });

  it('says hello so the isolated script sends settings', () => {
    const got: ToIsolated[] = [];
    onIsolatedMessage((m) => got.push(m));
    createFilterState();
    expect(got).toContainEqual({ type: 'hello' });
  });

  it('rebuilds the matcher when settings arrive', () => {
    const state = createFilterState();
    sendToMain({ type: 'settings', settings: { ...DEFAULT_SETTINGS, customTerms: ['vinewood'] } });
    expect(state.matcher.match('Vinewood sign').blocked).toBe(true);

    sendToMain({ type: 'settings', settings: { ...DEFAULT_SETTINGS, enabled: false } });
    expect(state.active).toBe(false);
  });

  it('batches removal counts', () => {
    vi.useFakeTimers();
    const got: ToIsolated[] = [];
    onIsolatedMessage((m) => got.push(m));
    const state = createFilterState();
    state.reportRemoved(2);
    state.reportRemoved(3);
    state.reportRemoved(0);
    vi.advanceTimersByTime(1000);
    expect(got.filter((m) => m.type === 'removed')).toEqual([{ type: 'removed', count: 5 }]);
    vi.useRealTimers();
  });

  it('ignores malformed events', () => {
    const state = createFilterState();
    document.dispatchEvent(new CustomEvent('sixbegone:to-main', { detail: '{not json' }));
    document.dispatchEvent(new CustomEvent('sixbegone:to-main', { detail: { type: 'settings' } }));
    expect(state.matcher.match('GTA 6').blocked).toBe(true);
  });
});
