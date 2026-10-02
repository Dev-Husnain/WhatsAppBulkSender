const fs = require('fs');
const { parse } = require('csv-parse/sync');

const HEADER = 'timestamp,number,status,error\n';

const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function createResultsLogger(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, HEADER);

  return function log(number, status, error = '') {
    const line = [new Date().toISOString(), number, status, error].map(escape).join(',');
    fs.appendFileSync(filePath, line + '\n');
  };
}

// Numbers that already have status "sent" in the results file (used by --resume)
function getAlreadySent(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const rows = parse(fs.readFileSync(filePath, 'utf8'), { columns: true, skip_empty_lines: true });
  return new Set(rows.filter((r) => r.status === 'sent').map((r) => r.number));
}

module.exports = { createResultsLogger, getAlreadySent };
