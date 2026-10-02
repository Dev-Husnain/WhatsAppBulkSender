# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js 18+, CommonJS, no TypeScript. There is no test suite, linter config, or build step for normal development.

```bash
npm install            # also downloads Puppeteer's Chrome (used when running from source)
npm run server         # web sender at http://localhost:3000 (what the page talks to)
npm start              # interactive terminal version (src/index.js)
npm run dry-run        # terminal version, previews but sends nothing — use this to exercise the flow safely
npm run resume         # terminal version, skips numbers already "sent" in results.csv
npm run logout         # deletes the saved WhatsApp login (.wwebjs_auth/)
npm run build:exe      # Windows only: builds dist/WhatsAppBulkSender.exe (Node SEA)
npm run deploy         # deploys public/ to Netlify
```

Releases: `gh release create vX.Y.Z dist/WhatsAppBulkSender.exe --title "vX.Y.Z" --generate-notes`. Download links point at `releases/latest`, so they need no edits.

Actually sending requires a real WhatsApp login (QR scan) and risks a ban on that number; prefer `dry-run` or a spare number when testing.

## Architecture

Two front ends share one core:

- **Web mode**: `src/server.js` (Express on `127.0.0.1`) + `public/index.html` (a single self-contained HTML/CSS/JS file). The page talks to the server via JSON endpoints (`/api/status`, `/api/send`, `/api/stop`, `/api/logout`, `/api/upload`) and receives live connection status and send progress over Server-Sent Events (`/api/events`). The same page is served locally *and* hosted on Netlify; when hosted, it calls `http://localhost:3000` (configurable, stored in the browser) on the visitor's own machine. Any API change must keep both serving modes working.
- **Terminal mode**: `src/index.js` uses `@inquirer/prompts`, reads `contacts.csv`/TXT, supports a per-row `file` column for attachments.
- **Shared core**: `client.js` (whatsapp-web.js `Client` with `LocalAuth`; `buildClient` for the server, `startClient` for the terminal), `sender.js` (`sendAll` loop: `getNumberId` → send → random interruptible delay, emits `progress`/`waiting`/`done` events), `contacts.js` (number normalization, dedupe, CSV parsing, `{placeholder}` substitution), `results.js` (appends to `results.csv`, resume support), `config.js` (`.env` settings), `paths.js`.

Key behaviors spread across files:

- **Security model** (`server.js` middleware): requests are rejected unless the `Host` header is `localhost:PORT`/`127.0.0.1:PORT` (DNS-rebinding defense, protects the QR code) and the `Origin` is the local page, the hosted Netlify URL (`HOSTED_PAGE` in `config.js`, always allowed), or `ALLOWED_ORIGINS`. Preflight sets `Access-Control-Allow-Private-Network` so the HTTPS Netlify page can reach localhost. Don't weaken these.
- **Attachments**: the page uploads each file once as a raw body (`X-Filename` header) to `/api/upload`; the server keeps a `MessageMedia` in memory keyed by UUID (1h TTL) and `/api/send` contacts reference it by `file` id. Uploads are deleted after the job. `MAX_UPLOAD_MB` is capped at 190 because whatsapp-web.js passes base64 to the browser over a 256 MB channel.
- **whatsapp-web.js patch**: `scripts/patch-wwebjs.js` (run by `postinstall` and by `build-exe.js`) edits `node_modules/whatsapp-web.js/src/util/Injected/Utils.js` to delete the media model's `__x_id`, without which every file send fails with "Data passed to getter must include an id property" (upstream wwebjs/whatsapp-web.js#201923). It's idempotent and warns if its anchor line disappears; remove it once a fixed whatsapp-web.js release is used.
- **Ready-timeout workaround**: after the first QR scan whatsapp-web.js sometimes never fires `ready`; both server and terminal restart the client after 30s (login is already saved). Server also restarts on `disconnected`.
- **Exe vs source** (`paths.js`, detected via `node:sea`): the exe stores the login in `%LOCALAPPDATA%\WhatsAppBulkSender` and `.env`/`results.csv` next to the exe, and uses the installed Chrome/Edge (`findBrowser`, override with `BROWSER_PATH`). From source, everything lives in the cwd and Puppeteer's bundled Chrome is used.
- **Exe build** (`scripts/build-exe.js`): esbuild bundles `scripts/exe-entry.js` → `src/server.js` only (not the terminal version), aliases `puppeteer` → `puppeteer-core`, stubs `fluent-ffmpeg` (`scripts/stubs/`), marks a few optional deps external, and inlines `public/index.html` as the `__EMBEDDED_PAGE__` define; then postject injects the blob into a copy of the current `node.exe`. A new runtime `require` of an optional/native module may need adding to `external` or a stub.

## Conventions

- User-facing text (README, page, console errors) is written in plain, non-technical language for people who just double-clicked an exe; `explainStartError` in `server.js` maps raw errors to such messages.
- New settings go in `config.js`, `.env.example`, and the README Configuration table.
- Speed presets live in `SPEEDS` in `server.js`; `normal` comes from `MIN_DELAY`/`MAX_DELAY`.
