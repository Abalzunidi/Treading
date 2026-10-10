import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { parseCsv, toDoc } from '../server/csv.js';

// مخزن في الذاكرة بنفس سلوك مخزن MongoDB (لا يحتاج اتصالاً بقاعدة بيانات)
function memoryRepo() {
  const docs = new Map();
  return {
    async syncSnapshot(rows) {
      const ds = rows.map(toDoc);
      ds.forEach((d) => docs.set(d.key, d));
      const openKeys = new Set(ds.filter((d) => d.status === 'OPEN').map((d) => d.key));
      let removed = 0;
      for (const [k, d] of docs) if (d.status === 'OPEN' && !openKeys.has(k)) { docs.delete(k); removed++; }
      return { received: ds.length, openRemoved: removed };
    },
    async list({ status } = {}) {
      return [...docs.values()].filter((d) => !status || d.status === status).map((d) => d.row);
    },
  };
}

const HEADER = 'ticket,symbol,type,volume,open_time,open_price,close_time,close_price,sl,tp,profit,swap,commission,net,magic,status,comment';
const OPEN = '10,EURUSDm,BUY,0.01,2026.09.10 14:12:00,1.16226,,,0.00000,1.17932,-4.00,0.00,0.00,-4.00,0,OPEN,';
const CLOSED = '11,EURUSDm,BUY,0.01,2026.09.01 10:00:00,1.10000,2026.09.02 10:00:00,1.10500,,,5.00,0.00,0.00,5.00,0,CLOSED,';

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test('sync ثم list، وإغلاق الصفقة المفتوحة يحذفها من المفتوحات ويبقي المغلقة', async () => {
  const app = createApp({ repo: memoryRepo() });
  await withServer(app, async (base) => {
    const post = (csv) => fetch(`${base}/api/trades/sync`, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv });

    let res = await post([HEADER, OPEN, CLOSED].join('\n'));
    assert.equal(res.status, 200);
    let rows = await (await fetch(`${base}/api/trades`)).json();
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((r) => r.status === 'OPEN').length, 1);

    // الصفقة 10 أُغلقت: تظهر مغلقة ولا تبقى مفتوحة
    const closed10 = '10,EURUSDm,BUY,0.01,2026.09.10 14:12:00,1.16226,2026.09.12 09:00:00,1.15900,,,-3.00,0.00,0.00,-3.00,0,CLOSED,';
    await post([HEADER, closed10, CLOSED].join('\n'));
    rows = await (await fetch(`${base}/api/trades`)).json();
    assert.equal(rows.filter((r) => r.status === 'OPEN').length, 0);
    assert.equal(rows.filter((r) => r.status === 'CLOSED').length, 2);
  });
});

test('يرفض الطلبات بدون رمز صحيح عندما يكون API_TOKEN مضبوطاً', async () => {
  const app = createApp({ repo: memoryRepo(), token: 'secret' });
  await withServer(app, async (base) => {
    assert.equal((await fetch(`${base}/api/trades`)).status, 401);
    assert.equal((await fetch(`${base}/api/trades`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await fetch(`${base}/api/trades`, { headers: { Authorization: 'Bearer secret' } })).status, 200);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  });
});

test('sync بدون نص يرجع 400', async () => {
  const app = createApp({ repo: memoryRepo() });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/trades/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 400);
  });
});

test('parseCsv يعمل على بيانات المثال', () => {
  assert.equal(parseCsv([HEADER, OPEN, CLOSED].join('\n')).length, 2);
});
