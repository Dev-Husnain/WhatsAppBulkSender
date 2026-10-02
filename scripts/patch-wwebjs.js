// Fixes sending files with whatsapp-web.js 1.34.7 on current WhatsApp Web.
// WhatsApp Web 2.3000.1047xxx added a private __x_id to its media model. whatsapp-web.js spreads
// that model into the outgoing message, so __x_id replaces the message id and every file fails with
// "Data passed to getter must include an id property". Upstream fix: wwebjs/whatsapp-web.js#201923.
// Runs after npm install and before building the exe. Safe to run more than once.
const fs = require('fs');

const file = require.resolve('whatsapp-web.js/src/util/Injected/Utils.js');
const MARKER = 'delete message.__x_id';
const ANCHOR = "        // Bot's won't reply if canonicalUrl is set (linking)";
const FIX = `        // Patched by scripts/patch-wwebjs.js: the media model's private id must not replace the message id
        if (message.__x_id) {
            ${MARKER};
        }

`;

const source = fs.readFileSync(file, 'utf8');
if (source.includes(MARKER)) {
  console.log('whatsapp-web.js media fix: already applied');
} else if (!source.includes(ANCHOR)) {
  console.warn('whatsapp-web.js media fix: code has changed, patch not applied (check if it is still needed)');
} else {
  fs.writeFileSync(file, source.replace(ANCHOR, FIX + ANCHOR));
  console.log('whatsapp-web.js media fix: applied');
}
