import { mirrorSettings, onIsolatedMessage, sendToMain } from '../core/bridge';
import type { Settings } from '../core/settings';
import { ALL_SITE_MATCHES } from '../core/sites';
import { addRemoved, loadSettings, onSettingsChanged } from '../core/storage';

// ISOLATED world: relays settings into the MAIN-world interceptor and
// removal counts back out to storage. Shared by every site.
export default defineContentScript({
  matches: ALL_SITE_MATCHES,
  runAt: 'document_start',
  async main() {
    const deliver = (settings: Settings) => {
      mirrorSettings(settings);
      sendToMain({ type: 'settings', settings });
    };
    const push = async () => deliver(await loadSettings());

    onIsolatedMessage((msg) => {
      if (msg.type === 'hello') void push();
      else if (msg.type === 'removed' && Number.isFinite(msg.count) && msg.count > 0) {
        void addRemoved(Math.min(msg.count, 10_000));
      }
    });
    onSettingsChanged(deliver);

    // Covers the case where the MAIN script said hello before we were listening.
    await push();
  },
});
