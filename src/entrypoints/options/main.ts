import { parseLines } from '../../core/settings';
import { ALL_SITE_MATCHES } from '../../core/sites';
import { loadSettings, saveSettings } from '../../core/storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fields = ['customTerms', 'allowTerms', 'customChannels'] as const;

async function init() {
  const settings = await loadSettings();
  for (const f of fields) $<HTMLTextAreaElement>(f).value = settings[f].join('\n');
  await checkAccess();
}

async function checkAccess() {
  const granted = await browser.permissions.contains({ origins: ALL_SITE_MATCHES });
  $<HTMLElement>('access').hidden = granted;
}

$<HTMLButtonElement>('grant').addEventListener('click', async () => {
  // Must be called directly from the click for the browser to show the prompt.
  await browser.permissions.request({ origins: ALL_SITE_MATCHES });
  await checkAccess();
});

$<HTMLButtonElement>('save').addEventListener('click', async () => {
  const patch = Object.fromEntries(
    fields.map((f) => [f, parseLines($<HTMLTextAreaElement>(f).value)]),
  );
  await saveSettings(patch);
  const saved = $<HTMLElement>('saved');
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 1500);
});

void init();
