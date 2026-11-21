import { isActive } from '../../core/settings';
import { loadSettings, loadStats, saveSettings } from '../../core/storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const enabled = $<HTMLInputElement>('enabled');
const status = $<HTMLParagraphElement>('status');
const count = $<HTMLElement>('count');
const pause = $<HTMLButtonElement>('pause');

async function render() {
  const [settings, stats] = await Promise.all([loadSettings(), loadStats()]);
  enabled.checked = settings.enabled;
  count.textContent = stats.removedTotal.toLocaleString();

  const paused = settings.enabled && settings.pausedUntil > Date.now();
  if (!settings.enabled) status.textContent = 'Off: GTA 6 content is visible.';
  else if (paused) {
    const until = new Date(settings.pausedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    status.textContent = `Paused until ${until}.`;
  } else status.textContent = isActive(settings) ? 'Removing GTA 6 content.' : '';
  pause.textContent = paused ? 'Resume now' : 'Pause 10 min';
  pause.disabled = !settings.enabled;
}

enabled.addEventListener('change', async () => {
  await saveSettings({ enabled: enabled.checked, pausedUntil: 0 });
  await render();
});

pause.addEventListener('click', async () => {
  const s = await loadSettings();
  const paused = s.pausedUntil > Date.now();
  await saveSettings({ pausedUntil: paused ? 0 : Date.now() + 10 * 60_000 });
  await render();
});

$<HTMLButtonElement>('options').addEventListener('click', () => {
  void browser.runtime.openOptionsPage();
});

void render();
