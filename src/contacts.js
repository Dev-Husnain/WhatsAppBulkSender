const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// "+92 300-1234567" -> "923001234567", "03001234567" -> "923001234567"
function normalizeNumber(raw, defaultCountryCode) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = defaultCountryCode + digits.slice(1);
  return digits;
}

const isValidNumber = (number) => number.length >= 10 && number.length <= 15;

// Replaces {column} placeholders with values from the contact's row, e.g. {name}
function fillTemplate(template, row = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => row[key] ?? match);
}

function toContact(rawNumber, defaultCountryCode, row = {}) {
  const number = normalizeNumber(rawNumber, defaultCountryCode);
  return {
    rawNumber: String(rawNumber ?? '').trim(),
    number,
    valid: isValidNumber(number),
    row: { ...row, number },
    fileMessage: row.message || '',
  };
}

// Splits on commas, semicolons or new lines (not spaces, so "+92 300 1234567" stays one number)
function parseNumberList(text, defaultCountryCode) {
  return String(text)
    .split(/[,;\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((n) => toContact(n, defaultCountryCode));
}

// .csv needs a "number" column (optional: name, message, any other columns).
// Any other file is read as one number per line.
function loadNumbersFile(filePath, defaultCountryCode) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, 'utf8');

  if (path.extname(filePath).toLowerCase() !== '.csv') {
    return parseNumberList(text, defaultCountryCode);
  }

  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  if (rows.length && !('number' in rows[0])) {
    throw new Error('CSV file must have a "number" column');
  }
  return rows.map((row) => toContact(row.number, defaultCountryCode, row));
}

// Keeps the first occurrence of each number
function dedupe(contacts) {
  const seen = new Set();
  return contacts.filter((c) => {
    if (seen.has(c.number)) return false;
    seen.add(c.number);
    return true;
  });
}

module.exports = {
  normalizeNumber,
  isValidNumber,
  fillTemplate,
  toContact,
  parseNumberList,
  loadNumbersFile,
  dedupe,
};
