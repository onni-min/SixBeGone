import { createFilterState } from '../core/filter-state';
import { YOUTUBE_MATCHES } from '../core/sites';
import { startYouTube } from '../sites/youtube';

// Runs inside the page (MAIN world) before YouTube's own scripts, so it can
// wrap fetch/XHR and initial data before the page captures them.
export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  world: 'MAIN',
  runAt: 'document_start',
  allFrames: false,
  main() {
    startYouTube(createFilterState());
  },
});
