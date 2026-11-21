# SixBeGone

A browser extension that **removes GTA 6 content** before you see it, on YouTube and X. TikTok and Instagram are planned.

Unlike blur-style spoiler blockers, SixBeGone filters a site's own data (the API responses the page loads) and drops GTA 6 items before the page draws them, so nothing flashes on screen. A page-level fallback catches anything that slips through.

> Unofficial. Not affiliated with, endorsed by, or connected to Rockstar Games or Take-Two Interactive.

## Status

Early development, YouTube complete for a first release:

- Home feed, subscriptions, search, watch-page sidebar, end screen, Shorts shelves and infinite scroll: GTA 6 items are removed before they render.
- Opening a GTA 6 video directly shows a full-page cover with the player paused ("Go back" or "Watch anyway").
- GTA 6 Shorts are skipped in the Shorts player.
- Comments that mention GTA 6 are removed from every video. A thread stays if only a reply matches; the reply goes.
- Autoplay won't roll into a GTA 6 video.

On X: GTA 6 posts are removed from the home timeline, search, profiles, threads and lists before they render, including long posts, quote posts, reposts, link previews and image descriptions. A thread goes whole if its opening post matches; otherwise only the matching replies go. GTA 6 trends are removed from Explore and the sidebar.

| Site | Status |
|---|---|
| YouTube | Done |
| X | Done (needs real-world testing) |
| TikTok | Planned |
| Instagram | Planned |

## What gets removed

Only **GTA 6**. GTA 5, GTA Online and older games stay visible.

Matching uses weighted phrases (see [`src/rules/gta6.json`](src/rules/gta6.json)):

- **Strong phrases** remove a post on their own: "GTA 6", "GTA VI", "Grand Theft Auto VI", "#GTA6", the protagonists' full names, and so on.
- **Weak phrases** only count together: "Leonida", "Vice City", "Jason and Lucia", plain "GTA". "Leonida map tour" + "GTA" is removed; "GTA Vice City Definitive Edition" is not.

Text is normalized first, so `G.T.A. 6`, `gta6`, `GTAVI`, full-width characters and zero-width-character tricks all match.

**Strict mode** (toggle in the popup or settings) widens this to all GTA games (GTA 5, GTA Online, Vice City, San Andreas, FiveM/RP…) and everything Rockstar Games makes, including Red Dead Redemption, Max Payne and L.A. Noire. Plain "rockstar" alone isn't enough, so energy drinks and music stay visible. The extra phrases are in [`src/rules/strict.json`](src/rules/strict.json).

In settings you can add your own keywords, phrases to always show, and channels to block.

## How it works

```
page loads feed ──► MAIN-world script (document_start)
                    wraps fetch/XHR + initial data
                    └─► matcher ──► GTA 6 items removed from the JSON
                ──► page fallback (MutationObserver)
                    └─► matcher ──► anything missed is hidden
```

- `src/core/`: matcher, normalization, settings, and the bridge between the in-page script and the extension.
- `src/sites/<site>/`: one folder per site integration (`youtube`, `x`).
- `src/entrypoints/`: WXT entrypoints (content scripts, background, popup, options).
- `src/rules/`: built-in rules, shipped as data.

## Development

Requires Node 20+.

```sh
npm install
npm run dev            # Chrome with live reload
npm run dev:firefox    # Firefox
npm test               # unit tests
npm run typecheck
npm run build          # .output/chrome-mv3
npm run build:firefox  # .output/firefox-mv3
npm run zip            # store-ready zip
```

To load a build manually: in Chrome open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and select `.output/chrome-mv3`. In Firefox open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on** and select `.output/firefox-mv3/manifest.json`.

Firefox (128+) doesn't grant site access at install. The settings page shows a **Grant access** button.

## Contributing

GTA 6 content getting through, or something removed that shouldn't be? Open an issue with the page URL and the exact title or text.

Code contributions are MIT-licensed. **Don't paste code from GPL, MPL or unlicensed projects.** If you adapt code from an MIT/BSD/Apache project, add it to [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE)
