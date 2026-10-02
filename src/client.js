const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { dataDir, findBrowser } = require('./paths');

// A headless WhatsApp Web client. The login is saved in .wwebjs_auth/ and reused,
// so the QR code only has to be scanned once.
function buildClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(dataDir, '.wwebjs_auth') }),
    webVersionCache: { type: 'local', path: path.join(dataDir, '.wwebjs_cache') },
    puppeteer: {
      headless: true,
      executablePath: findBrowser(),
      // Skip Chrome features WhatsApp Web doesn't need, so it starts faster
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    },
  });
}

// After the first QR scan, "ready" sometimes never fires. The login is saved by then,
// so restarting the client fixes it.
const READY_TIMEOUT_MS = 30 * 1000;

// Terminal version: prints the QR code in the console and resolves when ready.
function startClient(attempt = 1) {
  const client = buildClient();

  return new Promise((resolve, reject) => {
    let readyTimer;
    client.on('qr', (qr) => {
      console.log('\nScan this QR code with WhatsApp on your phone');
      console.log('(WhatsApp > Settings > Linked devices > Link a device)\n');
      qrcode.generate(qr, { small: true });
    });
    client.on('authenticated', () => {
      console.log('Logged in, loading chats...');
      readyTimer = setTimeout(async () => {
        if (attempt >= 3) return reject(new Error('WhatsApp did not become ready. Try again in a minute.'));
        console.log('Still not ready, restarting WhatsApp...');
        client.removeAllListeners();
        await client.destroy().catch(() => {});
        startClient(attempt + 1).then(resolve, reject);
      }, READY_TIMEOUT_MS);
    });
    client.on('auth_failure', (msg) => reject(new Error(`Authentication failed: ${msg}`)));
    client.on('ready', () => {
      clearTimeout(readyTimer);
      resolve(client);
    });
    client.initialize().catch(reject);
  });
}

module.exports = { buildClient, startClient };
