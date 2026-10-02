const { select, input, confirm } = require('@inquirer/prompts');
const config = require('./config');
const { parseNumberList, loadNumbersFile, dedupe, fillTemplate } = require('./contacts');
const { createResultsLogger, getAlreadySent } = require('./results');
const { sendAll, sleep } = require('./sender');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESUME = args.includes('--resume');

// Lets you type "\n" in a one-line prompt to get a new line in the message
const unescapeNewlines = (text) => text.replace(/\\n/g, '\n');
const notEmpty = (value) => value.trim() !== '' || 'Please type something';

async function askNumbers() {
  const source = await select({
    message: 'How do you want to give the numbers?',
    choices: [
      { name: 'Type or paste them', value: 'type' },
      { name: 'Load from a file (.csv or .txt)', value: 'file' },
    ],
  });

  if (source === 'type') {
    const text = await input({
      message: 'Numbers (separate with commas):',
      validate: notEmpty,
    });
    return parseNumberList(text, config.defaultCountryCode);
  }

  const filePath = await input({
    message: 'File path:',
    default: config.contactsFile,
    validate: notEmpty,
  });
  return loadNumbersFile(filePath.trim().replace(/^"|"$/g, ''), config.defaultCountryCode);
}

async function askSender() {
  const name = (await input({ message: 'Your name (sender, optional):' })).trim();
  if (!name) return { name: '', signature: false };
  const signature = await confirm({ message: `Add "— ${name}" at the end of every message?`, default: true });
  return { name, signature };
}

async function askMessages(contacts) {
  const hasFileMessages = contacts.some((c) => c.fileMessage);
  const hasNames = contacts.some((c) => c.row.name);

  const choices = [
    { name: 'One message for all numbers', value: 'one' },
    { name: 'A separate message for each number', value: 'each' },
  ];
  if (hasFileMessages) {
    choices.unshift({ name: 'Use the messages from the file', value: 'file' });
  }

  const mode = await select({ message: 'Which messages should be sent?', choices });
  const placeholders = [hasNames && '{name} for the name', contacts[0].row.sender && '{sender} for your name'].filter(Boolean);
  console.log(`Tip: type \\n for a new line${placeholders.length ? `, ${placeholders.join(', ')}` : ''}.`);

  if (mode === 'one') {
    const template = unescapeNewlines(await input({ message: 'Message for everyone:', validate: notEmpty }));
    return contacts.map((c) => ({ ...c, message: fillTemplate(template, c.row) }));
  }

  if (mode === 'file') {
    let fallback = null;
    if (contacts.some((c) => !c.fileMessage)) {
      fallback = unescapeNewlines(
        await input({ message: 'Some rows have no message. Message for those:', validate: notEmpty }),
      );
    }
    return contacts.map((c) => ({ ...c, message: fillTemplate(c.fileMessage || fallback, c.row) }));
  }

  const result = [];
  for (const c of contacts) {
    const label = c.row.name ? `${c.row.name} (${c.number})` : c.number;
    const message = unescapeNewlines(await input({ message: `Message for ${label}:`, validate: notEmpty }));
    result.push({ ...c, message: fillTemplate(message, c.row) });
  }
  return result;
}

function printPreview(contacts) {
  console.log('\n--- Preview ---\n');
  contacts.forEach((c, i) => {
    const flag = c.valid ? '' : '  [INVALID NUMBER, will be skipped]';
    console.log(`${i + 1}. ${c.number}${flag}`);
    console.log(`   ${c.message.replace(/\n/g, '\n   ')}\n`);
  });
}

async function main() {
  console.log('\nWhatsApp bulk sender\n');

  let contacts = await askNumbers();
  const before = contacts.length;
  contacts = dedupe(contacts);
  if (contacts.length < before) console.log(`Removed ${before - contacts.length} duplicate number(s).`);

  if (RESUME) {
    const sent = getAlreadySent(config.resultsFile);
    const count = contacts.length;
    contacts = contacts.filter((c) => !sent.has(c.number));
    console.log(`Resume: skipping ${count - contacts.length} number(s) already sent.`);
  }

  if (contacts.length === 0) {
    console.log('No numbers to send to.');
    return;
  }
  console.log(`${contacts.length} number(s) loaded.\n`);

  const sender = await askSender();
  contacts = contacts.map((c) => ({ ...c, row: { ...c.row, sender: sender.name } }));

  contacts = await askMessages(contacts);
  if (sender.signature) {
    contacts = contacts.map((c) => ({ ...c, message: `${c.message}\n\n— ${sender.name}` }));
  }
  printPreview(contacts);

  if (DRY_RUN) {
    console.log('Dry run: nothing was sent.');
    return;
  }

  if (!(await confirm({ message: `Send ${contacts.length} message(s) now?`, default: false }))) {
    console.log('Cancelled.');
    return;
  }

  // Loaded here so a dry run doesn't start WhatsApp at all
  const { startClient } = require('./client');
  console.log('\nStarting WhatsApp (headless)...');
  const client = await startClient();
  console.log('WhatsApp is ready.\n');

  let stopRequested = false;
  // Ctrl+C: finish cleanly so the saved login isn't corrupted
  process.on('SIGINT', () => {
    if (stopRequested) process.exit(1);
    stopRequested = true;
    console.log('\nStopping after the current message... (run "npm run resume" to continue later)');
  });

  const { stats } = await sendAll(client, contacts, {
    minDelay: config.minDelay,
    maxDelay: config.maxDelay,
    log: createResultsLogger(config.resultsFile),
    shouldStop: () => stopRequested,
    onEvent: (e) => {
      if (e.type === 'progress') {
        const status = e.status === 'sent' ? 'sent' : `${e.status}${e.error ? `: ${e.error}` : ''}`;
        console.log(`[${e.index + 1}/${e.total}] ${e.number} ${status}`);
      } else if (e.type === 'waiting') {
        console.log(`   waiting ${e.seconds}s...`);
      }
    },
  });

  console.log(`\nDone. Sent: ${stats.sent}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
  console.log(`Details saved to ${config.resultsFile}`);

  // Give WhatsApp a moment to deliver the last message before closing
  await sleep(3000);
  await client.destroy();
}

main().catch((err) => {
  // Ctrl+C while a question is open
  if (err.name === 'ExitPromptError') {
    console.log('\nCancelled.');
    return;
  }
  console.error('Error:', err.message);
  process.exit(1);
});
