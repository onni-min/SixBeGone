import { onIsolatedMessage, sendToMain } from '../core/bridge';
import { ALL_SITE_MATCHES } from '../core/sites';
import { addRemoved, loadSettings, onSettingsChanged } from '../core/storage';

// ISOLATED world: relays settings into the MAIN-world interceptor and
// removal counts back out to storage. Shared by every site.
export default defineContentScript({
  matches: ALL_SITE_MATCHES,
  runAt: 'document_start',
  async main() {
    const push = async () => sendToMain({ type: 'settings', settings: await loadSettings() });

    onIsolatedMessage((msg) => {
      if (msg.type === 'hello') void push();
      else if (msg.type === 'removed' && Number.isFinite(msg.count) && msg.count > 0) {
        void addRemoved(Math.min(msg.count, 10_000));
      }
    });
    onSettingsChanged((settings) => sendToMain({ type: 'settings', settings }));

    // Covers the case where the MAIN script said hello before we were listening.
    await push();
  },
});
