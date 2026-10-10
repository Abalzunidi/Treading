import crypto from 'node:crypto';
import express from 'express';
import { parseCsv } from './csv.js';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

export function createApp({ repo, token = '', frontendDir }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }));

  const auth = (req, res, next) => {
    if (!token) return next();
    const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (crypto.timingSafeEqual(sha(given), sha(token))) return next();
    res.status(401).json({ error: 'unauthorized' });
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/trades', auth, async (req, res, next) => {
    try {
      res.json(await repo.list({ status: req.query.status, symbol: req.query.symbol }));
    } catch (e) { next(e); }
  });

  // يقبل نص CSV خام (Content-Type: text/csv) أو JSON: { "csv": "..." }
  app.post('/api/trades/sync', auth, async (req, res, next) => {
    try {
      const text = typeof req.body === 'string' ? req.body : req.body?.csv;
      if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'أرسل نص CSV' });
      }
      res.json(await repo.syncSnapshot(parseCsv(text)));
    } catch (e) { next(e); }
  });

  if (frontendDir) app.use(express.static(frontendDir));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  });

  return app;
}
