import { createFilterState } from '../core/filter-state';
import { X_MATCHES } from '../core/sites';
import { startX } from '../sites/x';

// Runs inside the page (MAIN world) before X's own scripts, so it can wrap
// fetch/XHR before X captures them.
export default defineContentScript({
  matches: X_MATCHES,
  world: 'MAIN',
  runAt: 'document_start',
  allFrames: false,
  main() {
    startX(createFilterState());
  },
});
