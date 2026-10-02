# WhatsApp Bulk Sender

Send a WhatsApp message to many numbers at once, from your own computer, using your own WhatsApp account.
Use the clean **web interface** or the step-by-step **terminal** version. Both support one message for
everyone or a different message for each number.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshot-dark.png">
    <img src="docs/screenshot-light.png" alt="WhatsApp Bulk Sender web interface" width="560">
  </picture>
</p>

> [!WARNING]
> This project automates WhatsApp Web and is **not affiliated with, endorsed by, or connected to WhatsApp or Meta**.
> Automating WhatsApp is against its Terms of Service, and **your number can be banned**, especially
> when sending to many people or to people who don't have you saved. Use it at your own risk, test with
> a spare number first, and **only message people who expect to hear from you.** Don't use it for spam.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Using the web interface](#using-the-web-interface)
- [Using the terminal version](#using-the-terminal-version)
- [Contacts file format](#contacts-file-format)
- [Configuration](#configuration)
- [Sending speed](#sending-speed)
- [Security](#security)
- [Sharing with others](#sharing-with-others)
- [Hosting the page on Netlify](#hosting-the-page-on-netlify)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- **Your own WhatsApp:** log in once by scanning a QR code, just like WhatsApp Web. The login is saved for next time.
- **No WhatsApp window:** WhatsApp runs in a hidden browser in the background.
- **Flexible messages:** one message for everyone, a separate message per number, or messages from a CSV file.
- **Attachments:** send an image, PDF, document, audio or video (up to 150 MB by default) to everyone, or a different file per number. The message can go as the file's caption.
- **Placeholders:** `{name}` inserts the contact's name and `{sender}` inserts your name. Any CSV column works as `{column}`.
- **Sender name:** optionally sign every message with `— Your Name`.
- **Any number format:** `+92 300 1234567`, `0300-1234567` and `923001234567` all work. Duplicates are removed automatically.
- **Safe sending:** random pauses between messages, with a choice of Fast, Normal and Safe speeds.
- **Live progress:** see each number as sent, failed or not on WhatsApp, and stop at any time.
- **Results log:** every attempt is saved to `results.csv`, and you can resume an interrupted run.
- **Dark and light mode:** the page follows your system theme and works on mobile.

## How it works

```
 ┌────────────────────┐   http://localhost:3000   ┌──────────────────────┐          ┌──────────┐
 │  Web page          │ ────────────────────────▶ │  Sender (Node.js)    │ ───────▶ │ WhatsApp │
 │  localhost:3000    │   numbers + messages      │  on YOUR computer    │ hidden   │  servers │
 │  or Netlify        │ ◀──────────────────────── │  whatsapp-web.js     │ Chrome   │          │
 └────────────────────┘   QR code, live progress  └──────────────────────┘          └──────────┘
```

The **sender** is a small Node.js program that runs on your computer. It uses
[whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js) to open WhatsApp Web in a hidden Chrome window
logged in to your account. The **web page** is only the interface. It can be opened from the sender itself
(`http://localhost:3000`) or from a hosted copy (for example on Netlify), and it always talks to the sender on
the computer it's opened on.

That's why the sender must run on your PC: WhatsApp needs a browser that stays logged in, which normal
static web hosting can't provide.

## Requirements

- [Node.js](https://nodejs.org) **18 or newer** (the LTS version is recommended)
- Windows, macOS or Linux
- A phone with WhatsApp to scan the QR code
- About 300 MB of disk space (a copy of Chrome is downloaded automatically on first install)

## Quick start

### Windows (easiest)

1. Install [Node.js](https://nodejs.org).
2. Download this project (**Code → Download ZIP**) and unzip it.
3. Double-click **`start.bat`**.

   The first time, it installs everything (about a minute). Then it starts the sender and opens
   `http://localhost:3000` in your browser.

### Any system

```bash
git clone https://github.com/Dev-Husnain/WhatsAppBulkSender.git
cd WhatsAppBulkSender
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run server
```

Then open **http://localhost:3000**.

## Using the web interface

1. **Connect WhatsApp:** on your phone, open WhatsApp → **Settings → Linked devices → Link a device** and
   scan the QR code on the page. The first time, loading your chats can take up to a minute. After that,
   it connects in about 5 seconds.
2. **Numbers:** type or paste them (one per line or comma-separated), or click **Import CSV / TXT**.
3. **Message:**
   - Enter **your name** and tick **Sign each message** to add `— Your Name` at the end.
   - Choose **Same for everyone** or **Different for each**. When you import a CSV with a `message`
     column, it switches to **Different for each** and fills those in for you.
4. **Attachment (optional):** click **Attach file** to send the same file to everyone. In **Different for each**,
   click **Attach** next to a number to give that person their own file. Keep **Send message as caption** ticked
   to put the text under the file, or untick it to send the file and the text as two messages. A message is
   optional when a file is attached.
5. **Send:** pick a speed, check the preview bubble, and click **Send**. Progress appears live, and you can **Stop** at any time.

Files are sent from your PC straight to WhatsApp and held in the sender's memory only until they're sent.
The default limit is 150 MB per file (`MAX_UPLOAD_MB` in `.env`, up to about 190 MB; see [Configuration](#configuration)).
Sending files in bulk looks more like spam than text, so prefer the **Normal** or **Safe** speed.

Use **Log out** on the page to unlink WhatsApp from this computer.

## Using the terminal version

```bash
npm start
```

The terminal asks you step by step:

```
? How do you want to give the numbers?   › Type or paste them / Load from a file (.csv or .txt)
? Numbers (separate with commas):        923000000001, 03000000002
? Your name (sender, optional):          Ali Khan
? Add "— Ali Khan" at the end of every message?  Yes
? Which messages should be sent?         › One message for all numbers / A separate message for each number
? Message for everyone:                  Hi {name}!\nSee you tomorrow.
? Attach a file for everyone? (path, empty for none):  D:\files\price-list.pdf
--- Preview ---
? Send 2 message(s) now?                 No
```

Type `\n` for a new line in a message. On the first run, a QR code is printed in the terminal to scan.

| Command | What it does |
|---|---|
| `npm start` | Interactive terminal version |
| `npm run dry-run` | Same questions and preview, but **sends nothing** |
| `npm run resume` | Skips numbers already marked `sent` in `results.csv` (use after Ctrl+C or a crash) |
| `npm run server` | Starts the sender for the web interface |
| `npm run logout` | Deletes the saved WhatsApp login from this computer |

## Contacts file format

**CSV** (`contacts.csv`): a `number` column is required. `name`, `message` and any other columns are optional.

```csv
number,name,message
923000000001,Ali,"Hi {name}, your order is ready!"
+92 300 0000002,Sara,
03000000003,Ahmed,"Custom message just for Ahmed"
```

- Rows with an empty `message` use the message you type (one for all).
- **Terminal version only:** add a `file` column with a file path (absolute, or relative to the folder you run
  from) to send that row its own attachment, e.g. `923000000001,Ali,"Your invoice",invoices/ali.pdf`. On the
  web page, use the **Attach** buttons instead.
- Wrap messages that contain commas in double quotes.
- Any column can be used as a placeholder. A `city` column, for example, becomes `{city}`.

**TXT:** one number per line.

**Number rules:** spaces, `+`, `-` and brackets are removed. A leading `00` is dropped, and a leading `0` is
replaced with your `DEFAULT_COUNTRY_CODE`. Numbers must end up 10–15 digits long, otherwise they are skipped
as invalid.

## Configuration

Settings live in `.env` (copy it from `.env.example`):

| Setting | Default | Meaning |
|---|---|---|
| `DEFAULT_COUNTRY_CODE` | `92` | Added to numbers that start with `0` |
| `DEFAULT_MESSAGE` | `Hi {name}, …` | Fallback message (terminal version) |
| `MIN_DELAY` / `MAX_DELAY` | `5` / `15` | Pause range in seconds for the **Normal** speed |
| `CONTACTS_FILE` | `contacts.csv` | Default file offered by the terminal version |
| `RESULTS_FILE` | `results.csv` | Where results are written |
| `ALLOWED_ORIGINS` | Netlify URL | Extra web pages allowed to use the sender, comma-separated |
| `PORT` | `3000` | Port for the sender. The page is then at `http://localhost:<PORT>`. |

## Sending speed

| Speed | Pause between messages | 50 messages take about |
|---|---|---|
| Fast | 2–5 s | 3 min |
| Normal | 5–15 s (from `.env`) | 8 min |
| Safe | 15–30 s | 19 min |

Shorter pauses finish sooner but look more like spam to WhatsApp. Use **Fast** only for small lists of people
who know you.

## Security

- **Everyone uses their own number.** The sender runs on each person's own computer with their own WhatsApp
  login. Opening a shared page never gives anyone access to someone else's WhatsApp.
- **Local only.** The sender listens on `127.0.0.1`, so other devices on your network can't reach it.
- **Trusted pages only.** Requests are accepted only from `localhost` and the pages in `ALLOWED_ORIGINS`.
  Requests with any other `Host` header are rejected, which blocks other websites, including
  [DNS rebinding](https://en.wikipedia.org/wiki/DNS_rebinding) attacks that could otherwise read your login QR code.
- **Your login stays private.** It is stored in `.wwebjs_auth/`. **Never share or upload this folder**,
  because anyone with it can use your WhatsApp. It's in `.gitignore`, and `npm run package` never includes it.
- **Nothing is stored online.** Numbers and messages go straight from the page to your own computer.

## Sharing with others

Anyone can use this with their own WhatsApp:

- **From GitHub:** send them the link to this repository and the [Quick start](#quick-start) steps.
- **As a ZIP:** run `npm run package` to create `public/download/whatsapp-sender.zip` (code only, no logins
  or personal files). The web page also links to this file whenever the sender isn't running.

Each person then runs `start.bat` (or `npm run server`) and scans the QR code with their own phone.

## Hosting the page on Netlify

The web page is a single static file (`public/index.html`), so you can host your own copy:

```bash
npx netlify-cli login
npx netlify-cli deploy --prod --dir public --create-site your-site-name   # first time
npm run deploy                                                            # later updates
```

Then add your site's URL to `ALLOWED_ORIGINS` in `.env` (and in `.env.example` and `start.bat` if you share the
project), so the sender accepts requests from it.

Notes:
- The hosted page still needs the sender running on the visitor's computer.
- Use Chrome, Edge or Firefox. If the browser asks to allow access to devices on your local network, click **Allow**.
- New Netlify sites can have **Visitor access** protection on. Turn it off under
  *Project configuration → Access & security* if you want anyone to open the page.

## Project structure

```
├── public/
│   └── index.html      Web interface (HTML, CSS and JS in one file)
├── src/
│   ├── server.js       Local sender used by the web interface (Express + Server-Sent Events)
│   ├── index.js        Interactive terminal version
│   ├── sender.js       Send loop with random pauses (shared by both versions)
│   ├── client.js       WhatsApp client setup, QR login and auto-restart
│   ├── contacts.js     Number cleanup, CSV/TXT reading, placeholders
│   ├── results.js      results.csv logging and resume support
│   ├── config.js       Settings from .env
│   └── logout.js       Deletes the saved login
├── scripts/
│   └── package.ps1     Builds the shareable ZIP
├── docs/               Screenshots
├── start.bat           One-click start for Windows
├── contacts.csv        Example contacts
└── .env.example        Example settings
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Page says **"Sender not running"** | Start it with `start.bat` or `npm run server` and keep that window open. |
| Stuck on **"Logged in, loading your chats…"** | This happens sometimes after the first scan. The sender restarts itself after 30 seconds and reconnects without a new scan. |
| **Port 3000 is already in use** | The sender is already running in another window. Close it, or set a different `PORT`. |
| **Not on WhatsApp** for a valid number | Check the country code. A number starting with `0` gets `DEFAULT_COUNTRY_CODE` added. |
| Netlify page can't connect | Make sure the sender is running, the site URL is in `ALLOWED_ORIGINS`, and you clicked **Allow** for local network access. Or use `http://localhost:3000`. |
| Want to switch WhatsApp accounts | Click **Log out** on the page, or run `npm run logout`, then scan again. Also remove the old device in WhatsApp → Linked devices. |
| Chrome failed to download during install | Run `npm rebuild puppeteer`. |

## License

[MIT](LICENSE) © Dev-Husnain

Built with [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js), [Express](https://expressjs.com) and
[Inquirer](https://github.com/SBoudrias/Inquirer.js).
