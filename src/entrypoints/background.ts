import { ALL_SITE_MATCHES } from '../core/sites';
import { loadSettings, saveSettings } from '../core/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    // Write defaults so every field exists.
    await saveSettings(await loadSettings());

    // Firefox MV3 doesn't grant host permissions at install. Without them the
    // content scripts never run, so send the user to the options page, which
    // has a button to grant access.
    if (reason === 'install') {
      const granted = await browser.permissions.contains({ origins: ALL_SITE_MATCHES });
      if (!granted) await browser.runtime.openOptionsPage();
    }
  });
});
