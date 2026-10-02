const fs = require('fs');
const os = require('os');
const path = require('path');

// True when running as WhatsAppBulkSender.exe (a Node single executable application)
const isExe = (() => {
  try {
    return require('node:sea').isSea();
  } catch {
    return false;
  }
})();

// Where results.csv and an optional .env go: next to the exe, or the project folder
const appDir = isExe ? path.dirname(process.execPath) : process.cwd();

// Private data (WhatsApp login, web cache). For the exe it lives in the user's
// AppData folder, so it isn't lying around next to a downloaded file.
const dataDir = isExe
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'WhatsAppBulkSender')
  : process.cwd();
fs.mkdirSync(dataDir, { recursive: true });

// Installed Chrome or Edge, so the exe doesn't need to ship its own browser.
// Returns undefined when running from source, where Puppeteer's own Chrome is used.
function findBrowser() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  if (!isExe) return undefined;
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = roots.flatMap((root) => [
    path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]);
  return candidates.find((file) => fs.existsSync(file));
}

module.exports = { isExe, appDir, dataDir, findBrowser };
