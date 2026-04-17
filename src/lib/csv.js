'use strict';

// RFC 4180 CSV quoter. Quote when the field contains [",\r\n]; escape " as "".
function quoteField(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(fields) {
  return fields.map(quoteField).join(',');
}

function format(rows) {
  return rows.map(row).join('\n');
}

module.exports = { quoteField, row, format };
