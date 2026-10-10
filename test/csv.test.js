import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, tradeKey, toDoc } from '../server/csv.js';

const HEADER = 'ticket,symbol,type,volume,open_time,open_price,close_time,close_price,sl,tp,profit,swap,commission,net,magic,status,comment';

test('يصحّح نوع الصفقة المغلقة المعكوس بحسب إشارة الربح', () => {
  const csv = [
    HEADER,
    // BUY حقيقية (ربحت لأن السعر ارتفع) لكنها مكتوبة SELL
    '1,EURUSDm,SELL,0.01,2026.09.14 08:12:09,1.10000,2026.09.15 10:00:00,1.10500,,,5.00,0.00,0.00,5.00,0,CLOSED,',
    // SELL حقيقية (ربحت لأن السعر نزل) لكنها مكتوبة BUY
    '2,EURUSDm,BUY,0.01,2026.09.14 08:12:09,1.10000,2026.09.15 10:00:00,1.09500,,,5.00,0.00,0.00,5.00,0,CLOSED,',
    // مفتوحة: لا تُعدَّل
    '3,EURUSDm,BUY,0.01,2026.09.14 08:12:09,1.10000,,,0.00000,1.12000,-2.00,0.00,0.00,-2.00,0,OPEN,',
  ].join('\n');
  const rows = parseCsv(csv);
  assert.deepEqual(rows.map((r) => r.type), ['BUY', 'SELL', 'BUY']);
});

test('يتجاهل الأسطر الناقصة والحالات غير المعروفة', () => {
  const csv = [HEADER, 'bad,line', '9,X,BUY,0.01,,1,,,,,0,0,0,0,0,WEIRD,'].join('\n');
  assert.equal(parseCsv(csv).length, 0);
});

test('مفتاح فريد: المفتوحة بالتذكرة، والمغلقة بالتذكرة ووقت الإغلاق', () => {
  const open = { status: 'OPEN', ticket: '7', close_time: '' };
  const c1 = { status: 'CLOSED', ticket: '7', close_time: '2026.01.01 10:00:00' };
  const c2 = { status: 'CLOSED', ticket: '7', close_time: '2026.01.01 11:00:00' };
  assert.equal(tradeKey(open), 'open:7');
  assert.notEqual(tradeKey(c1), tradeKey(c2));
});

test('toDoc يحوّل أوقات MT5 إلى تواريخ', () => {
  const d = toDoc({ status: 'CLOSED', ticket: '1', symbol: 'EURUSDm', open_time: '2026.09.14 08:12:09', close_time: '2026.09.15 10:00:00' });
  assert.ok(d.openAt instanceof Date && d.closeAt instanceof Date);
  assert.ok(d.closeAt > d.openAt);
});
