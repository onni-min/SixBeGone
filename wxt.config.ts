import { defineConfig } from 'wxt';
import { ALL_SITE_MATCHES } from './src/core/sites';

export default defineConfig({
  srcDir: 'src',
  // Firefox defaults to MV2 in WXT; we ship MV3 everywhere (MAIN-world
  // content scripts need Firefox 128+ with MV3).
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'SixBeGone',
    description:
      'Removes GTA 6 videos, posts and comments before you see them. Unofficial; not affiliated with Rockstar Games or Take-Two.',
    permissions: ['storage'],
    host_permissions: ALL_SITE_MATCHES,
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'sixbegone@onni-min.github.io',
              strict_min_version: '128.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
