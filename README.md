# SpeedControl Pro

[**Install from Chrome Web Store**](https://chromewebstore.google.com/detail/dggicpgmhomnaacljcidmffhbahiplni)

Precise playback speed control for every HTML5 video and audio element. Per-site profiles, customizable keyboard shortcuts, and a refined popup interface.

> **Fork of [Video Speed Controller](https://github.com/igrigorik/videospeed)** by Ilya Grigorik. This project builds on the original with a rewritten UI, improved reliability, and new features like site profiles and session-aware speed sync.

## Features

- **Universal speed control** — works on YouTube, Netflix, Coursera, and any site with HTML5 media
- **Per-site profiles** — save a preferred speed for any domain (e.g. 2x for lectures, 1.5x for podcasts)
- **Keyboard shortcuts** — fully customizable, with support for multiple preferred-speed bindings
- **On-video overlay** — minimal speed indicator that stays out of the way
- **Remembers your speed** — picks up where you left off, per-site or globally

## Keyboard shortcuts

- **S** - decrease playback speed
- **D** - increase playback speed
- **R** - reset playback speed to 1.0x
- **Z** - rewind video by 10 seconds
- **X** - advance video by 10 seconds
- **G** - toggle between current and preferred speed
- **V** - show/hide the controller

Customize shortcuts and add new ones from the extension's settings page. You can assign multiple "preferred speed" shortcuts with different values for quick toggling. After changes, refresh the video page for them to take effect.

Some sites bind their own shortcuts to the same keys. As a workaround, the extension listens for both lower and upper case (`Shift+<key>`) variants.

## Site profiles

Save per-site speed defaults, controller visibility, audio behavior, and shortcut overrides — all without changing your global settings. Open the popup on any site to save or clear a profile.

## FAQ

**Controls not showing up?** The extension only works with HTML5 video. If a site uses Flash, try disabling Flash in `chrome://settings/content/flash` and reloading.

**Controls not showing for local files?** Navigate to `chrome://extensions`, find SpeedControl Pro, and enable "Allow access to file URLs".

## Development

This repo builds a Manifest V3 Chrome extension into `dist/`.

### Setup

```
pnpm install
pnpm build
```

Load `dist/` as an unpacked extension from `chrome://extensions`.

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Watch build |
| `pnpm build` | Production build |
| `pnpm lint` | Lint source and tests |
| `pnpm typecheck` | TypeScript type checks |
| `pnpm test:unit` | Unit tests |
| `pnpm test:integration` | Integration tests |
| `pnpm test:e2e` | End-to-end tests |
| `pnpm zip` | Build and package |

### Project structure

- `src/core/` — settings, storage, controller, and action logic
- `src/content/` — content-script bridge and page injection runtime
- `src/ui/` — popup, options page, controller overlay, and UI helpers
- `src/observers/` — media and mutation observers
- `src/site-handlers/` — site-specific controller placement/behavior
- `tests/` — unit, integration, and e2e tests

### Architecture

- Page-context modules use the global `window.VSC` namespace
- Settings flow through shared Chrome sync/session storage adapters
- The popup queries the content script for live playback state and falls back to profile/storage data
- Options page supports both global settings and per-site profiles

## Attribution

This project is a fork of [Video Speed Controller](https://github.com/igrigorik/videospeed) by [Ilya Grigorik](https://github.com/igrigorik), originally released under the MIT License.

## License

MIT License — Copyright (c) 2014 Ilya Grigorik, 2026 Mustafa Gomaa
