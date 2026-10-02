const crypto = require('crypto');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('./config');
const { buildClient } = require('./client');
const { toContact, dedupe } = require('./contacts');
const { createResultsLogger } = require('./results');
const { sendAll } = require('./sender');

const { isExe } = require('./paths');

const PORT = Number(process.env.PORT || 3000);
const HOST = '127.0.0.1'; // only reachable from this computer
const PAGE_URL = `http://localhost:${PORT}`;

// The exe has the page built in (see scripts/build-exe.js); from source it's read from public/
// eslint-disable-next-line no-undef
const EMBEDDED_PAGE = typeof __EMBEDDED_PAGE__ !== 'undefined' ? __EMBEDDED_PAGE__ : null;

// Pages allowed to talk to this server: the local page plus the hosted (Netlify) page
const allowedOrigins = new Set([PAGE_URL, `http://127.0.0.1:${PORT}`, ...config.allowedOrigins]);

// Host names this server answers to. Anything else is a DNS rebinding attempt
// (a website pointing its own domain at 127.0.0.1 to read the QR code).
const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

// Pause between messages in seconds. Shorter pauses are faster but make a ban more likely.
const SPEEDS = {
  fast: [2, 5],
  normal: [config.minDelay, config.maxDelay],
  safe: [15, 30],
};

// ---------- WhatsApp connection state ----------

const state = { status: 'starting', qr: null, me: null, error: null };
const job = { running: false, stop: false, events: [] };

// Attachments uploaded by the page, kept in memory until they are sent
const MAX_UPLOAD_MB = 64;
const UPLOAD_TTL_MS = 60 * 60 * 1000;
const uploads = new Map(); // id -> { media, name, size, expires }

function pruneUploads() {
  const now = Date.now();
  for (const [id, u] of uploads) if (u.expires < now) uploads.delete(id);
}
const listeners = new Set();
let client;

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of listeners) res.write(data);
}

function setState(patch) {
  Object.assign(state, { error: null }, patch);
  broadcast({ type: 'status', ...state });
}

// After the first QR scan, whatsapp-web.js sometimes logs in but never fires "ready".
// The login is saved by then, so restarting the client fixes it.
const READY_TIMEOUT_MS = 30 * 1000;
let readyTimer;

async function restartWhatsApp(reason) {
  console.log(`Restarting WhatsApp: ${reason}`);
  clearTimeout(readyTimer);
  const old = client;
  client = null;
  old?.removeAllListeners();
  await old?.destroy().catch(() => {});
  setState({ status: 'starting', qr: null, me: null });
  startWhatsApp();
}

function startWhatsApp() {
  const c = buildClient();
  client = c;
  const t0 = Date.now();
  const logEvent = (name, ...args) => console.log(`[wa +${((Date.now() - t0) / 1000).toFixed(1)}s] ${name}`, ...args);
  ['qr', 'authenticated', 'auth_failure', 'ready', 'disconnected', 'change_state'].forEach((name) =>
    c.on(name, (arg) => logEvent(name, name === 'qr' ? '' : arg ?? '')),
  );
  c.on('loading_screen', (percent, message) => logEvent('loading', `${percent}% ${message}`));

  c.on('qr', async (qr) => setState({ status: 'qr', qr: await QRCode.toDataURL(qr, { margin: 1, width: 280 }) }));
  c.on('authenticated', () => {
    setState({ status: 'connecting', qr: null });
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => restartWhatsApp('logged in but not ready after 30s'), READY_TIMEOUT_MS);
  });
  c.on('ready', () => {
    clearTimeout(readyTimer);
    setState({ status: 'ready', qr: null, me: c.info?.wid?.user || null });
  });
  c.on('auth_failure', () => setState({ status: 'error', qr: null, error: 'WhatsApp login failed. Restart the sender and scan again.' }));
  c.on('disconnected', (reason) => restartWhatsApp(`disconnected (${reason})`));
  c.initialize().catch((err) => {
    if (client !== c) return; // this client was replaced by a restart
    const error = explainStartError(err.message);
    console.error(`WhatsApp failed to start: ${err.message}\n${error}`);
    setState({ status: 'error', qr: null, error });
  });
}

function explainStartError(message) {
  if (/BLOCKED_BY_ADMINISTRATOR/.test(message)) {
    return 'WhatsApp Web is blocked on this computer by your organization (browser policy). Ask your IT admin, or use a personal computer.';
  }
  if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/.test(message)) {
    return 'Could not reach WhatsApp. Check your internet connection and restart the sender.';
  }
  if (/executable|Browser was not found|Failed to launch/i.test(message)) {
    return 'Could not start a browser. Make sure Google Chrome or Microsoft Edge is installed.';
  }
  return 'WhatsApp could not start. Restart the sender and try again.';
}

// ---------- HTTP server ----------

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  if (!allowedHosts.has(req.headers.host)) return res.status(403).send('Forbidden host');

  const origin = req.headers.origin;
  if (origin) {
    if (!allowedOrigins.has(origin)) return res.status(403).json({ error: `Origin ${origin} is not allowed` });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET,POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Filename');
    // Lets an https page (Netlify) reach this localhost server in Chrome
    res.set('Access-Control-Allow-Private-Network', 'true');
    return res.sendStatus(204);
  }
  next();
});

if (EMBEDDED_PAGE) {
  app.get('/', (req, res) => res.type('html').send(EMBEDDED_PAGE));
} else {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

app.get('/api/status', (req, res) => {
  res.json({ ...state, sending: job.running, config: { speeds: SPEEDS, defaultCountryCode: config.defaultCountryCode } });
});

// Live updates (connection status + sending progress) as Server-Sent Events
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'status', ...state })}\n\n`);
  if (job.running) job.events.forEach((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
  listeners.add(res);
  req.on('close', () => listeners.delete(res));
});

// The page uploads each attachment once (raw body, name in X-Filename) and refers to it by id
app.post('/api/upload', express.raw({ type: () => true, limit: `${MAX_UPLOAD_MB}mb` }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Empty file' });
  pruneUploads();
  const name = decodeURIComponent(req.get('X-Filename') || 'file').replace(/[\\/]/g, '_').slice(0, 200);
  const type = req.get('Content-Type') || 'application/octet-stream';
  const id = crypto.randomUUID();
  uploads.set(id, {
    media: new MessageMedia(type, req.body.toString('base64'), name, req.body.length),
    name,
    size: req.body.length,
    expires: Date.now() + UPLOAD_TTL_MS,
  });
  res.json({ id, name, size: req.body.length });
});

app.post('/api/send', (req, res) => {
  if (state.status !== 'ready') return res.status(409).json({ error: 'WhatsApp is not connected yet' });
  if (job.running) return res.status(409).json({ error: 'Already sending' });

  const items = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
  const missing = items.find((c) => c?.file && !uploads.has(c.file));
  if (missing) return res.status(400).json({ error: 'An attachment has expired. Please attach it again.' });

  const contacts = dedupe(
    items
      .filter((c) => c && c.number && (String(c.message || '').trim() || c.file))
      .map((c) => ({
        ...toContact(c.number, config.defaultCountryCode),
        message: String(c.message || ''),
        media: c.file ? uploads.get(c.file).media : null,
      })),
  );
  if (contacts.length === 0) return res.status(400).json({ error: 'No contacts with a number and a message or file' });
  const usedFiles = new Set(items.map((c) => c?.file).filter(Boolean));

  const [minDelay, maxDelay] = SPEEDS[req.body.speed] || SPEEDS.normal;

  Object.assign(job, { running: true, stop: false, events: [] });
  const onEvent = (e) => {
    job.events.push(e);
    broadcast(e);
  };
  onEvent({ type: 'start', total: contacts.length });

  sendAll(client, contacts, {
    minDelay,
    maxDelay,
    caption: req.body.caption !== false,
    log: createResultsLogger(config.resultsFile),
    shouldStop: () => job.stop,
    onEvent,
  })
    .catch((err) => onEvent({ type: 'done', error: err.message, stats: null }))
    .finally(() => {
      job.running = false;
      usedFiles.forEach((id) => uploads.delete(id));
    });

  res.json({ ok: true, total: contacts.length });
});

app.post('/api/stop', (req, res) => {
  job.stop = true;
  res.json({ ok: true });
});

app.post('/api/logout', async (req, res) => {
  if (job.running) return res.status(409).json({ error: 'Stop sending first' });
  try {
    await client.logout();
  } catch {
    // ignore, we restart below anyway
  }
  await restartWhatsApp('logged out');
  res.json({ ok: true });
});

// Send errors as JSON so the page can show them (e.g. a file over the size limit)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const tooLarge = err.type === 'entity.too.large';
  res.status(err.status || 500).json({ error: tooLarge ? `File is too large (max ${MAX_UPLOAD_MB} MB)` : err.message });
});

app.listen(PORT, HOST, (err) => {
  if (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`The sender is already running. Opening ${PAGE_URL} ...`);
      if (isExe) openBrowser();
    } else {
      console.error(`Server failed to start: ${err.message}`);
    }
    return exitAfterKeypress(1);
  }
  console.log('\n  WhatsApp Bulk Sender is running');
  console.log(`  Open ${PAGE_URL} (or the hosted page) in your browser.`);
  console.log('  Keep this window open while sending. Close it to stop.\n');
  if (!isExe) console.log(`Allowed pages: ${[...allowedOrigins].join(', ')}\n`);
  startWhatsApp();
  if (isExe) openBrowser();
});

function openBrowser() {
  if (process.env.NO_OPEN) return;
  require('child_process').exec(`start "" "${PAGE_URL}"`);
}

// A double-clicked exe closes its window on exit, so leave errors readable
function exitAfterKeypress(code) {
  if (!isExe || !process.stdin.isTTY) process.exit(code);
  console.log('\nPress any key to close.');
  process.stdin.setRawMode(true);
  process.stdin.once('data', () => process.exit(code));
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await client?.destroy().catch(() => {});
  process.exit(0);
});
