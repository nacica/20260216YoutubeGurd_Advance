# CLAUDE.md - CleanTube Project Guide

## Project Overview
CleanTube is a PWA (Progressive Web App) YouTube viewer that provides an ad-free, Shorts-free viewing experience. Built with vanilla JavaScript (no frameworks). Deployed on GitHub Pages.

- **Repo**: https://github.com/nacica/20260216YoutubeGurd_Advance
- **Live URL**: https://nacica.github.io/20260216YoutubeGurd_Advance/
- **Deploy**: Push to `main` branch triggers GitHub Pages auto-deploy

## Tech Stack
- Vanilla JavaScript (ES5-compatible, no modules/bundler)
- HTML5 / CSS3 (cyberpunk/neon theme)
- YouTube Data API v3
- Google Identity Services (OAuth 2.0)
- Service Worker for PWA
- localStorage for persistence

## Directory Structure
```
cleantube/
  index.html          # Single-page app entry point
  manifest.json       # PWA manifest
  sw.js               # Service Worker (cache busting)
  css/
    style.css         # All styles (cyberpunk theme, responsive grid)
  js/
    app.js            # Main app: routing, state, event binding, OAuth flow
    api.js            # YouTube API client (search, feed, channels, subscriptions)
    ui.js             # DOM rendering (screens, video cards, settings)
    storage.js        # localStorage wrapper (API key, settings, hidden videos)
    utils.js          # Utilities (formatting, filtering, escapeHtml, debounce)
    player.js         # YouTube embed player (nocookie)
  icons/              # PWA icons
```

## Architecture
- All JS uses IIFE module pattern (`var Module = (function() { ... })()`)
- Global modules: `App`, `UI`, `YouTubeAPI`, `Storage`, `Utils`, `Player`
- No build step - files loaded via `<script>` tags in order: storage -> utils -> api -> player -> ui -> app
- Single-page app with screen switching (`.screen.active`)

## Key Patterns
- **Video card creation**: `UI.createVideoCard(video, showHideBtn)` in ui.js
- **Home feed**: `App.showHome()` -> `YouTubeAPI.getPersonalizedFeed()` (OAuth) or `getHomeFeed()` (public)
- **Filtering pipeline**: Shorts filter (`Utils.isShorts`) -> NG word filter (`Utils.filterNGVideos`) -> Hidden videos filter (localStorage)
- **Storage keys**: All prefixed with `cleantube_` in localStorage
- **Navigation**: Internal history stack with browser pushState

## Content Filtering
- **Shorts**: Videos <= 60s or with #shorts in title (togglable in settings)
- **NG words**: Hardcoded list in `utils.js` (CN/KR/K-POP keywords)
- **Hidden videos**: User-driven, stored in `cleantube_hiddenVideos` localStorage key

## Development Notes
- No dev server needed - open `cleantube/index.html` directly or use any static server
- No tests, no linter, no build process
- CSS uses CSS custom properties (`:root` variables) for theming
- Responsive grid: 2 cols (mobile) -> 3 -> 4 -> 5 cols (desktop)
- All user-facing text is in Japanese

## Commit Style
- `feat:` for new features
- `fix:` for bug fixes
- `ci:` for CI/deploy changes
- Keep messages concise, in English
