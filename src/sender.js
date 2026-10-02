const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sleeps in small steps so a stop request takes effect quickly
async function interruptibleSleep(ms, shouldStop) {
  const end = Date.now() + ms;
  while (Date.now() < end && !shouldStop()) {
    await sleep(Math.min(250, end - Date.now()));
  }
}

// Sends one contact's message and optional attachment (a whatsapp-web.js MessageMedia).
// With caption on, the text goes under the file; otherwise the file and text are sent separately.
async function sendOne(client, chatId, { message, media }, caption) {
  const text = message.trim() ? message : '';
  if (!media) return client.sendMessage(chatId, text);
  if (caption && text) return client.sendMessage(chatId, media, { caption: text });
  await client.sendMessage(chatId, media);
  if (text) await client.sendMessage(chatId, text);
}

/**
 * Sends each contact its message, one at a time, with a random delay in between.
 * contacts: [{ number, message, media?, valid? }]
 * onEvent receives { type: 'progress' | 'waiting' | 'done', ... }
 */
async function sendAll(client, contacts, { minDelay, maxDelay, caption = true, log, onEvent = () => {}, shouldStop = () => false }) {
  const stats = { sent: 0, failed: 0, skipped: 0 };
  const total = contacts.length;

  for (let i = 0; i < total && !shouldStop(); i++) {
    const c = contacts[i];
    const report = (status, error = '') => {
      if (status === 'sent') stats.sent++;
      else if (status === 'failed') stats.failed++;
      else stats.skipped++;
      log?.(c.number, status, error);
      onEvent({ type: 'progress', index: i, total, number: c.number, status, error });
    };

    if (c.valid === false) {
      report('invalid', `Invalid number "${c.rawNumber ?? c.number}"`);
      continue;
    }

    try {
      const waId = await client.getNumberId(c.number);
      if (!waId) {
        report('not_on_whatsapp');
        continue;
      }
      // Newer WhatsApp Web versions renamed _serialized, so fall back to building the id
      const chatId = waId._serialized || waId.$1 || `${waId.user}@${waId.server}`;
      await sendOne(client, chatId, c, caption);
      report('sent');
    } catch (err) {
      report('failed', err.message);
    }

    if (i < total - 1 && !shouldStop()) {
      const ms = 1000 * (minDelay + Math.random() * (maxDelay - minDelay));
      onEvent({ type: 'waiting', seconds: Math.round(ms / 100) / 10 });
      await interruptibleSleep(ms, shouldStop);
    }
  }

  const stopped = shouldStop();
  onEvent({ type: 'done', stats, stopped });
  return { stats, stopped };
}

module.exports = { sendAll, sleep };
