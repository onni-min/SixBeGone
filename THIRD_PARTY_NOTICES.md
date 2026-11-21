# Third-party notices

SixBeGone is MIT-licensed. This file lists third-party code included in or adapted into this repository, with its license.

## Included or adapted code

_None yet._ When code is adapted from another project, add an entry here with the project, URL, license, copyright line, and the files it went into.

## Studied for reference only (no code copied)

These projects informed the design. Their code is **not** included, because their licenses aren't compatible with copying into an MIT project, or they have no license:

| Project | License | What we learned |
|---|---|---|
| [amitbl/blocktube](https://github.com/amitbl/blocktube) | GPL-3.0 | Filtering YouTube's JSON before render; fetch/XHR and initial-data hooks |
| [varshneydevansh/FilterTube](https://github.com/varshneydevansh/FilterTube) | MIT | Renderer and view-model names (`lockupViewModel`, `shortsLockupViewModel`), the `ytInitialData` accessor trap. Our YouTube code is written independently; if code is adapted from FilterTube later, it moves to the section above. |
| [MrOplus/x-interceptor](https://github.com/MrOplus/x-interceptor) | None (all rights reserved) | X GraphQL interception by operation name, judging entries by the tweets inside rather than entryId, depth-first pruning of `entries`/`items`/`moduleItems`, `note_tweet` for long posts. Our X code is written independently. |

## Build tools

Dependencies installed from npm (WXT, Vite, Vitest, TypeScript) keep their own licenses and are not redistributed in this repository.
