/**
 * Minimal X GraphQL shapes, trimmed to what the pruner reads. Replace or
 * extend with real captured responses (DevTools, Network, filter "graphql").
 */

export const user = (screenName: string, name = screenName, id = `u-${screenName}`) => ({
  user_results: {
    result: { __typename: 'User', rest_id: id, core: { name, screen_name: screenName }, legacy: {} },
  },
});

export const tweet = (id: string, text: string, author = 'someone', extra: Record<string, unknown> = {}) => ({
  __typename: 'Tweet',
  rest_id: id,
  core: user(author),
  legacy: { id_str: id, full_text: text, lang: 'en' },
  ...extra,
});

export const tweetEntry = (t: object, entryId = `tweet-${(t as { rest_id: string }).rest_id}`) => ({
  entryId,
  sortIndex: '1',
  content: {
    entryType: 'TimelineTimelineItem',
    __typename: 'TimelineTimelineItem',
    itemContent: { itemType: 'TimelineTweet', __typename: 'TimelineTweet', tweet_results: { result: t } },
  },
});

export const cursor = (dir: 'Top' | 'Bottom') => ({
  entryId: `cursor-${dir.toLowerCase()}-123`,
  content: { entryType: 'TimelineTimelineCursor', __typename: 'TimelineTimelineCursor', value: 'abc', cursorType: dir },
});

export const whoToFollow = () => ({
  entryId: 'who-to-follow-1',
  content: {
    entryType: 'TimelineTimelineModule',
    items: [{ entryId: 'u1', item: { itemContent: { __typename: 'TimelineUser', user_results: user('gta6fan').user_results } } }],
  },
});

export const conversation = (id: string, tweets: object[]) => ({
  entryId: `home-conversation-${id}`,
  content: {
    entryType: 'TimelineTimelineModule',
    __typename: 'TimelineTimelineModule',
    items: tweets.map((t) => ({
      entryId: `home-conversation-${id}-tweet-${(t as { rest_id: string }).rest_id}`,
      item: { itemContent: { __typename: 'TimelineTweet', tweet_results: { result: t } } },
    })),
  },
});

export const homeTimeline = () => ({
  data: {
    home: {
      home_timeline_urt: {
        instructions: [
          {
            type: 'TimelineAddEntries',
            entries: [
              tweetEntry(tweet('1', 'GTA 6 ending was insane, no spoilers but WOW')),
              tweetEntry(tweet('2', 'Morning coffee and code')),
              // Long post: full_text cut off before the GTA 6 part.
              tweetEntry(
                tweet('3', 'Thread on my weekend. First I went hiking, then', 'hiker', {
                  note_tweet: {
                    note_tweet_results: { result: { text: 'Thread on my weekend. First I went hiking, then played GTA VI until 4am' } },
                  },
                }),
              ),
              // Quote tweet of a GTA 6 post.
              tweetEntry(
                tweet('4', 'lol this', 'quoter', {
                  quoted_status_result: { result: tweet('40', 'Leaked Grand Theft Auto VI map', 'leaker') },
                }),
              ),
              // Retweet of a GTA 6 post (visibility wrapper).
              tweetEntry({
                __typename: 'TweetWithVisibilityResults',
                tweet: tweet('5', 'RT @news: GTA 6 sales record', 'retweeter', {
                  legacy: {
                    full_text: 'RT @news: GTA 6 sales record',
                    retweeted_status_result: { result: tweet('50', 'GTA 6 sales record', 'news') },
                  },
                }),
              }),
              // Link card with a GTA 6 headline.
              tweetEntry(
                tweet('6', 'interesting read https://t.co/x', 'reader', {
                  card: {
                    legacy: {
                      binding_values: [
                        { key: 'title', value: { string_value: 'Every GTA 6 easter egg found so far', type: 'STRING' } },
                      ],
                    },
                  },
                }),
              ),
              // Image with GTA 6 alt text.
              tweetEntry(
                tweet('7', 'look at this view', 'photo', {
                  legacy: {
                    full_text: 'look at this view',
                    extended_entities: { media: [{ type: 'photo', ext_alt_text: 'Screenshot of GTA 6 Vice City beach' }] },
                  },
                }),
              ),
              tweetEntry(tweet('8', 'GTA 5 Online is still fun')),
              whoToFollow(),
              conversation('c1', [tweet('90', 'What game are you playing?'), tweet('91', 'GTA 6 obviously'), tweet('92', 'Stardew')]),
              conversation('c2', [tweet('95', 'GTA 6 hype thread'), tweet('96', 'yes')]),
              cursor('Top'),
              cursor('Bottom'),
            ],
          },
        ],
      },
    },
  },
});

/** TweetDetail: replies arrive via moduleItems in TimelineAddToModule. */
export const tweetDetailReplies = () => ({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddToModule',
          moduleEntryId: 'conversationthread-1',
          moduleItems: [
            { entryId: 'conversationthread-1-tweet-201', item: { itemContent: { tweet_results: { result: tweet('201', 'Agreed!') } } } },
            {
              entryId: 'conversationthread-1-tweet-202',
              item: { itemContent: { tweet_results: { result: tweet('202', 'Reminds me of Jason Duval') } } },
            },
          ],
        },
      ],
    },
  },
});

export const exploreTrends = () => ({
  data: {
    explore_page: {
      body: {
        timelines: [
          {
            timeline: {
              instructions: [
                {
                  type: 'TimelineAddEntries',
                  entries: [
                    {
                      entryId: 'trends',
                      content: {
                        entryType: 'TimelineTimelineModule',
                        items: [
                          { entryId: 'trend-1', item: { itemContent: { __typename: 'TimelineTrend', name: '#GTA6', trend_metadata: { domain_context: 'Gaming · Trending' } } } },
                          { entryId: 'trend-2', item: { itemContent: { __typename: 'TimelineTrend', name: 'Leonida', trend_metadata: { domain_context: 'GTA · Trending' } } } },
                          { entryId: 'trend-3', item: { itemContent: { __typename: 'TimelineTrend', name: 'Champions League', trend_metadata: { domain_context: 'Sports' } } } },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    },
  },
});

/** A tweet in the late-2026 redesign shape: text in `details`, no legacy.full_text. */
export const tweet2026 = (id: string, text: string, author = 'someone', extra: Record<string, unknown> = {}) => ({
  __isTweetResult: 'Tweet',
  __typename: 'Tweet',
  id: `VHdlZXQ6${id}`,
  rest_id: id,
  core: user(author),
  details: { created_at_ms: 1795213708210, display_text_range: [0, text.length], full_text: text, hashtag_entities: [] },
  legacy: { conversation_id_str: id, entities: {}, lang: 'en' },
  media_entities2: [],
  ...extra,
});

/** UserOriginalsTimeline (profile) in the redesign, with a pinned post. */
export const profileTimeline2026 = () => ({
  data: {
    user_result_by_screen_name: {
      result: {
        __typename: 'User',
        id: 'VXNlcjox',
        profile_user_originals_timeline: {
          timeline: {
            instructions: [
              { type: 'TimelinePinEntry', __typename: 'TimelinePinEntry', entry: { entryId: 'tweet-p', content: { content: { tweet_results: { result: tweet2026('p', 'Pinned: GTA 6 day one!') } } } } },
              {
                type: 'TimelineAddEntries',
                __typename: 'TimelineAddEntries',
                entries: [
                  {
                    entryId: 'tweet-1',
                    content: {
                      __typename: 'TimelineTimelineItem',
                      content: {
                        __typename: 'TimelineTweet',
                        tweet_results: {
                          result: tweet2026('1', "im going to buy gta6, and spend 100 hours having my character go to sleep every night at 8 pm", 'bryan_johnson', {
                            quoted_tweet_results: {
                              __typename: 'TweetResults',
                              rest_id: '10',
                              result: tweet2026('10', 'Holy shit.\n\nIn GTA 6 you can literally do zone 2 cardio.', 'Brady_H'),
                            },
                          }),
                        },
                      },
                    },
                  },
                  { entryId: 'tweet-2', content: { content: { tweet_results: { result: tweet2026('2', 'On @netflix Jan 1') } } } },
                  { entryId: 'tweet-3', content: { content: { tweet_results: { result: tweet2026('3', 'quoting this', 'q', { quoted_tweet_results: { result: tweet2026('30', 'Leonida map is huge — GTA') } }) } } } },
                  { entryId: 'cursor-bottom-1', content: { __typename: 'TimelineTimelineCursor', value: 'x', cursorType: 'Bottom' } },
                ],
              },
            ],
          },
        },
      },
    },
  },
});

/** newsSidebarQuery: AI news stories. */
export const newsSidebar2026 = () => ({
  data: {
    story_topic: {
      stories: {
        items: [
          { trend_results: { result: { __typename: 'AiTrend', core: { category: 'Gaming', name: 'GTA 6 Breaks Launch Sales Records Worldwide' }, rest_id: 'a1' } } },
          { trend_results: { result: { __typename: 'AiTrend', core: { category: 'Sports', name: 'Derby Ends in Late Drama' }, rest_id: 'a2' } } },
        ],
      },
    },
  },
});
