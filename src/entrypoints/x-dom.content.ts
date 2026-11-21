import { runFallback } from '../core/fallback';
import { X_MATCHES } from '../core/sites';
import { createXScanner } from '../sites/x/dom';

// ISOLATED world fallback: hides GTA 6 tweets and trends the network layer missed.
export default defineContentScript({
  matches: X_MATCHES,
  runAt: 'document_start',
  async main() {
    await runFallback((matcher) => createXScanner(document, matcher));
  },
});
