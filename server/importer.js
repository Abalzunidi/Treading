import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv.js';

export function defaultJournalPath(env = process.env) {
  if (env.MT5_JOURNAL_CSV) return env.MT5_JOURNAL_CSV;
  if (!env.APPDATA) return '';
  return path.join(env.APPDATA, 'MetaQuotes', 'Terminal', 'Common', 'Files', 'trade_journal.csv');
}

// يراقب ملف المنصة ويرسل كل تغيير إلى قاعدة البيانات.
export function startImporter({ repo, file, intervalMs = 3000, log = console }) {
  if (!file) { log.warn('importer: لا يوجد مسار لملف الصفقات — تخطّيت الاستيراد التلقائي'); return () => {}; }
  let lastMtime = 0;
  let busy = false;

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const st = await fs.promises.stat(file).catch(() => null);
      if (st && st.mtimeMs !== lastMtime) {
        const text = await fs.promises.readFile(file, 'utf8');
        const res = await repo.syncSnapshot(parseCsv(text));
        lastMtime = st.mtimeMs;
        log.log(`importer: ${res.received} صفقة من ${path.basename(file)}`);
      }
    } catch (e) {
      log.error('importer:', e.message);
    } finally {
      busy = false;
    }
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  log.log('importer: يراقب', file);
  return () => clearInterval(timer);
}
