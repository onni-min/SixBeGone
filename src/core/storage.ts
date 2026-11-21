import { browser } from 'wxt/browser';
import { SETTINGS_KEY, STATS_KEY, withDefaults, type Settings, type Stats } from './settings';

export async function loadSettings(): Promise<Settings> {
  const res = await browser.storage.local.get(SETTINGS_KEY);
  return withDefaults(res[SETTINGS_KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export function onSettingsChanged(handler: (s: Settings) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[SETTINGS_KEY]) {
      handler(withDefaults(changes[SETTINGS_KEY].newValue));
    }
  });
}

export async function loadStats(): Promise<Stats> {
  const res = await browser.storage.local.get(STATS_KEY);
  const s = res[STATS_KEY] as Partial<Stats> | undefined;
  return { removedTotal: typeof s?.removedTotal === 'number' ? s.removedTotal : 0 };
}

export async function addRemoved(count: number): Promise<void> {
  const stats = await loadStats();
  await browser.storage.local.set({
    [STATS_KEY]: { removedTotal: stats.removedTotal + count },
  });
}
