/** Match patterns per supported site. Add TikTok and Instagram here as they land. */
export const YOUTUBE_MATCHES = ['*://www.youtube.com/*', '*://m.youtube.com/*'];
export const X_MATCHES = ['*://x.com/*', '*://twitter.com/*', '*://mobile.x.com/*', '*://mobile.twitter.com/*'];

export const ALL_SITE_MATCHES = [...YOUTUBE_MATCHES, ...X_MATCHES];
