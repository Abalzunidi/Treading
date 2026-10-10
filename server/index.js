import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectToMongoDB, disconnectFromMongoDB } from './db.js';
import { createTradesRepo } from './tradesRepo.js';
import { createApp } from './app.js';
import { startImporter, defaultJournalPath } from './importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const token = process.env.API_TOKEN || '';
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
if (!loopback && !token) {
  console.error('رفض التشغيل: HOST مفتوح للشبكة بدون API_TOKEN. اضبط API_TOKEN في .env أو أبقِ HOST=127.0.0.1');
  process.exit(1);
}

let stopImporter = () => {};
try {
  const db = await connectToMongoDB();
  const repo = createTradesRepo(db);
  await repo.init();
  stopImporter = startImporter({ repo, file: defaultJournalPath() });

  const app = createApp({ repo, token, corsOrigins, frontendDir: path.join(here, '..', 'frontend') });
  const server = app.listen(port, host, () => console.log(`http://${host}:${port}`));

  const shutdown = async () => {
    stopImporter();
    server.close();
    await disconnectFromMongoDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (err) {
  console.error('فشل التشغيل:', err.message);
  await disconnectFromMongoDB().catch(() => {});
  process.exit(1);
}
