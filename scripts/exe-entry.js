// Entry point for the exe. Hides Node deprecation warnings from dependencies
// (they mean nothing to someone who just double-clicked the app), then starts the sender.
process.noDeprecation = true;
process.title = 'WhatsApp Bulk Sender';
require('../src/server');
