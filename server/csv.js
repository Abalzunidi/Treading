// تحويل ملف الصفقات (trade_journal.csv) إلى صفوف + مفتاح فريد لكل صفقة.

export const COLUMNS = [
  'ticket', 'symbol', 'type', 'volume', 'open_time', 'open_price', 'close_time',
  'close_price', 'sl', 'tp', 'profit', 'swap', 'commission', 'net', 'magic', 'status', 'comment',
];

// الإكسبيرت القديم كان يكتب نوع الصفقة المغلقة معكوساً؛ نصحّحه بمقارنة إشارة الربح بحركة السعر.
export function fixClosedType(r) {
  if (r.status !== 'CLOSED') return r;
  const o = Number(r.open_price), c = Number(r.close_price), p = Number(r.profit);
  if (!(o > 0) || !(c > 0) || !p || o === c) return r;
  const expectBuy = (c - o) * p > 0;
  if (expectBuy && r.type === 'SELL') r.type = 'BUY';
  else if (!expectBuy && r.type === 'BUY') r.type = 'SELL';
  return r;
}

export function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < header.length) continue;
    const row = {};
    header.forEach((h, idx) => { row[h] = (parts[idx] ?? '').trim(); });
    if (row.status !== 'OPEN' && row.status !== 'CLOSED') continue;
    if (!row.ticket) continue;
    rows.push(fixClosedType(row));
  }
  return rows;
}

// "2026.09.10 14:12:00" (توقيت السيرفر) -> Date بدون تحويل منطقة زمنية، للترتيب فقط
export function parseMtTime(s) {
  const m = String(s || '').match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

// المغلقة قد تتكرر لنفس التذكرة (إغلاق جزئي) فنضيف وقت الإغلاق للمفتاح.
export function tradeKey(row) {
  return row.status === 'OPEN'
    ? `open:${row.ticket}`
    : `closed:${row.ticket}:${row.close_time}`;
}

export function toDoc(row) {
  return {
    key: tradeKey(row),
    status: row.status,
    symbol: row.symbol,
    ticket: row.ticket,
    openAt: parseMtTime(row.open_time),
    closeAt: parseMtTime(row.close_time),
    row,
  };
}
