const fs = require('fs');
const path = require('path');

// Deletes the saved session so the next run asks for a new QR scan.
// Also remove the linked device on your phone: WhatsApp > Settings > Linked devices.
const dir = path.join(process.cwd(), '.wwebjs_auth');
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('Saved session deleted.');
} else {
  console.log('No saved session found.');
}
