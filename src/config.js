const path = require('path');
const { appDir } = require('./paths');

require('dotenv').config({ path: path.join(appDir, '.env'), quiet: true });

// The hosted copy of the page. The sender always accepts requests from it.
const HOSTED_PAGE = 'https://wabulksenderhussnain.netlify.app';

const config = {
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '92',
  defaultMessage: process.env.DEFAULT_MESSAGE || 'Hello {name}!',
  minDelay: Number(process.env.MIN_DELAY || 5),
  maxDelay: Number(process.env.MAX_DELAY || 15),
  // whatsapp-web.js hands files to the browser as base64 over a 256 MB channel,
  // so about 190 MB is the most that can work (WhatsApp itself allows up to 2 GB)
  maxUploadMb: Math.min(Number(process.env.MAX_UPLOAD_MB || 150), 190),
  contactsFile: process.env.CONTACTS_FILE || 'contacts.csv',
  resultsFile: path.resolve(appDir, process.env.RESULTS_FILE || 'results.csv'),
  allowedOrigins: [HOSTED_PAGE, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map((s) => s.trim())
    .filter(Boolean),
};

if (config.minDelay > config.maxDelay) {
  throw new Error('MIN_DELAY must not be greater than MAX_DELAY');
}

module.exports = config;
