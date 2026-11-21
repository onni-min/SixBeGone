/**
 * Minimal YouTube InnerTube shapes for tests. These follow the structures
 * YouTube serves (and that FilterTube/BlockTube target), trimmed to the fields
 * that matter. Replace or extend with real captured responses: in DevTools,
 * Network tab, filter "youtubei", copy a response, and save it as JSON under
 * tests/fixtures/real/.
 */

export const run = (text: string) => ({ runs: [{ text }] });

export const channelRun = (name: string, id = 'UCchannel000', handle = '@channel') => ({
  runs: [
    {
      text: name,
      navigationEndpoint: { browseEndpoint: { browseId: id, canonicalBaseUrl: `/${handle}` } },
    },
  ],
});

export const videoRenderer = (id: string, title: string, channel = 'Some Channel', channelId?: string, handle?: string) => ({
  videoRenderer: {
    videoId: id,
    thumbnail: { thumbnails: [{ url: `https://i.ytimg.com/vi/${id}/hq720.jpg`, width: 720 }] },
    title: { runs: [{ text: title }], accessibility: { accessibilityData: { label: `${title} by ${channel}` } } },
    ownerText: channelRun(channel, channelId, handle),
    viewCountText: { simpleText: '12K views' },
    trackingParams: 'CAAQ',
    menu: { menuRenderer: { items: [{ menuServiceItemRenderer: { text: run('Add to queue') } }] } },
  },
});

export const compactVideoRenderer = (id: string, title: string, channel = 'Some Channel') => ({
  compactVideoRenderer: {
    videoId: id,
    title: { simpleText: title },
    longBylineText: channelRun(channel),
    viewCountText: { simpleText: '3K views' },
  },
});

export const lockupViewModel = (id: string, title: string, channel = 'Some Channel', channelId = 'UClockup000') => ({
  lockupViewModel: {
    contentId: id,
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    metadata: {
      lockupMetadataViewModel: {
        title: { content: title },
        image: { decoratedAvatarViewModel: { avatar: { avatarViewModel: { image: { sources: [] } } } } },
        metadata: {
          contentMetadataViewModel: {
            metadataRows: [
              {
                metadataParts: [
                  {
                    text: {
                      content: channel,
                      commandRuns: [
                        { onTap: { innertubeCommand: { browseEndpoint: { browseId: channelId } } } },
                      ],
                    },
                  },
                ],
              },
              { metadataParts: [{ text: { content: '1.2M views' } }, { text: { content: '2 days ago' } }] },
            ],
          },
        },
      },
    },
    rendererContext: { loggingContext: { loggingDirectives: { trackingParams: 'x' } } },
  },
});

export const shortsLockup = (id: string, title: string) => ({
  shortsLockupViewModel: {
    entityId: `shorts-shelf-item-${id}`,
    accessibilityText: `${title}, 1.4 million views - play Short`,
    overlayMetadata: { primaryText: { content: title }, secondaryText: { content: '1.4M views' } },
    onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: id } } },
  },
});

export const richItem = (inner: object) => ({ richItemRenderer: { content: inner, trackingParams: 'r' } });

export const continuation = () => ({
  continuationItemRenderer: {
    trigger: 'CONTINUATION_TRIGGER_ON_ITEM_SHOWN',
    continuationEndpoint: { continuationCommand: { token: 'abc' } },
  },
});

export const adSlot = () => ({ richItemRenderer: { content: { adSlotRenderer: { slotId: 'ad1' } } } });

export const richShelf = (title: string, items: object[]) => ({
  richSectionRenderer: { content: { richShelfRenderer: { title: run(title), contents: items } } },
});

/** Home page ytInitialData. */
export const homeInitialData = () => ({
  responseContext: { serviceTrackingParams: [] },
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [
        {
          tabRenderer: {
            selected: true,
            content: {
              richGridRenderer: {
                contents: [
                  richItem(videoRenderer('a1', 'GTA 6 Trailer 3 Breakdown')),
                  richItem(videoRenderer('a2', 'Cooking pasta in 10 minutes')),
                  richItem(lockupViewModel('a3', 'I finished GTA VI in one sitting')),
                  richItem(lockupViewModel('a4', 'GTA 5 Online new heist')),
                  adSlot(),
                  richShelf('Shorts', [
                    richItem(shortsLockup('s1', '#gta6 secret ending')),
                    richItem(shortsLockup('s2', 'cat jumps on table')),
                  ]),
                  richShelf('Latest GTA 6 news', [richItem(videoRenderer('n1', 'Patch 1.02 notes'))]),
                  continuation(),
                ],
              },
            },
          },
        },
      ],
    },
  },
});

/** /youtubei/v1/next response for a watch page (sidebar + end screen). */
export const watchNext = () => ({
  contents: {
    twoColumnWatchNextResults: {
      results: {
        results: {
          contents: [
            { videoPrimaryInfoRenderer: { title: run('My unrelated video') } },
            { videoSecondaryInfoRenderer: { owner: { videoOwnerRenderer: { title: run('Some Channel') } } } },
          ],
        },
      },
      secondaryResults: {
        secondaryResults: {
          results: [
            compactVideoRenderer('w1', 'Every GTA 6 easter egg'),
            compactVideoRenderer('w2', 'Lofi beats to study to'),
            lockupViewModel('w3', 'Leonida map tour', 'GTA Series Videos'),
            lockupViewModel('w4', 'Vice City Definitive Edition review'),
            continuation(),
          ],
        },
      },
    },
  },
  playerOverlays: {
    playerOverlayRenderer: {
      endScreen: {
        watchNextEndScreenRenderer: {
          results: [
            { endScreenVideoRenderer: { videoId: 'e1', title: { simpleText: 'Grand Theft Auto VI ending' } } },
            { endScreenVideoRenderer: { videoId: 'e2', title: { simpleText: 'Woodworking basics' } } },
          ],
        },
      },
    },
  },
});

/** /youtubei/v1/search response. */
export const searchResults = () => ({
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  {
                    channelRenderer: {
                      channelId: 'UCgta6news',
                      title: { simpleText: 'GTA 6 News Daily' },
                    },
                  },
                  videoRenderer('q1', 'gta6 map comparison'),
                  videoRenderer('q2', 'Best open world games of 2026', 'Gaming Weekly'),
                  {
                    reelShelfRenderer: {
                      title: run('Shorts'),
                      items: [shortsLockup('q3', 'G.T.A. 6 funny moments'), shortsLockup('q4', 'parkour fail')],
                    },
                  },
                ],
              },
            },
            continuation(),
          ],
        },
      },
    },
  },
});

/** A continuation (infinite scroll) response. */
export const homeContinuation = () => ({
  onResponseReceivedActions: [
    {
      appendContinuationItemsAction: {
        continuationItems: [
          richItem(videoRenderer('c1', 'Ranking every GTA 6 mission')),
          richItem(videoRenderer('c2', 'Morning routine')),
          continuation(),
        ],
      },
    },
  ],
});

/** New-format comments: thread holds only a commentId; text is in frameworkUpdates. */
export const commentEntity = (id: string, text: string, author = '@viewer', channelId = 'UCviewer') => ({
  payload: {
    commentEntityPayload: {
      key: `comment-${id}`,
      properties: { commentId: id, content: { content: text } },
      author: { displayName: author, channelId },
    },
  },
});

export const commentThread = (id: string, replies: object[] = []) => ({
  commentThreadRenderer: {
    commentViewModel: { commentViewModel: { commentId: id, commentKey: `comment-${id}` } },
    ...(replies.length ? { replies: { commentRepliesRenderer: { contents: replies } } } : {}),
  },
});

export const commentsContinuation = () => ({
  onResponseReceivedEndpoints: [
    {
      reloadContinuationItemsCommand: {
        continuationItems: [
          commentThread('t1'),
          commentThread('t2', [{ commentViewModel: { commentId: 'r1' } }, { commentViewModel: { commentId: 'r2' } }]),
          commentThread('t3'),
          { commentThreadRenderer: { comment: { commentRenderer: { contentText: run('Old format: GTA 6 hype') } } } },
          continuation(),
        ],
      },
    },
  ],
  frameworkUpdates: {
    entityBatchUpdate: {
      mutations: [
        commentEntity('t1', 'Great video, thanks!'),
        commentEntity('t2', 'Anyone else here after finishing the game?'),
        commentEntity('r1', 'yes, GTA 6 ending was wild'),
        commentEntity('r2', 'same'),
        commentEntity('t3', 'Lucia Caminos deserved better'),
      ],
    },
  },
});

/** Watch-next response for a video, with autoplay pointing at `nextTitle`. */
export const watchNextFor = (videoId: string, title: string, channel: string, nextTitle: string) => ({
  currentVideoEndpoint: { watchEndpoint: { videoId } },
  contents: {
    twoColumnWatchNextResults: {
      results: {
        results: {
          contents: [
            { videoPrimaryInfoRenderer: { title: run(title) } },
            {
              videoSecondaryInfoRenderer: {
                owner: {
                  videoOwnerRenderer: {
                    title: run(channel),
                    navigationEndpoint: { browseEndpoint: { browseId: 'UCowner' } },
                  },
                },
              },
            },
          ],
        },
      },
      autoplay: { autoplay: { sets: [{ autoplayVideo: { watchEndpoint: { videoId: 'next1' } } }] } },
    },
  },
  playerOverlays: {
    playerOverlayRenderer: {
      autoplay: {
        playerOverlayAutoplayRenderer: { videoTitle: { simpleText: nextTitle }, byline: run('Next Channel') },
      },
    },
  },
});

export const reelItemWatch = (videoId: string, title: string) => ({
  replacementEndpoint: { reelWatchEndpoint: { videoId } },
  overlay: {
    reelPlayerOverlayRenderer: {
      reelTitleText: { runs: [{ text: title }] },
      reelPlayerHeaderSupportedRenderers: { reelPlayerHeaderRenderer: { channelTitleText: run('Shorts Channel') } },
    },
  },
});
