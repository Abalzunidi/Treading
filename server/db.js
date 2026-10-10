import dns from 'node:dns';
import { MongoClient } from 'mongodb';

let client = null;

// بعض الشبكات/الراوترات ترفض استعلام SRV الذي يحتاجه mongodb+srv (الخطأ: querySrv ECONNREFUSED).
// نستخدم DNS عام بدلاً منها. عطّله بـ MONGODB_DNS=system في .env إن لم تحتجه.
function useReliableDns(env) {
  if (env.MONGODB_DNS === 'system') return;
  dns.setServers((env.MONGODB_DNS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()));
  dns.setDefaultResultOrder('ipv4first');
}

// يبني رابط الاتصال من الحقول (مع ترميز كلمة السر) أو من MONGODB_URI الجاهز.
export function buildMongoUri(env = process.env) {
  if (env.MONGODB_URI) return env.MONGODB_URI;
  const { MONGODB_USER: user, MONGODB_PASSWORD: pass, MONGODB_HOST: host } = env;
  if (!user || !pass || !host) {
    throw new Error('أكمل MONGODB_USER و MONGODB_PASSWORD و MONGODB_HOST في ملف .env');
  }
  return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/?appName=Cluster0`;
}

export async function connectToMongoDB(env = process.env) {
  const uri = buildMongoUri(env);
  if (uri.includes('<db_password>')) {
    throw new Error('استبدل <db_password> بكلمة السر الحقيقية في .env');
  }
  useReliableDns(env);
  client = new MongoClient(uri);
  await client.connect();
  const db = client.db(env.MONGODB_DB || 'treading');
  await db.command({ ping: 1 });
  console.log('You successfully connected to MongoDB!');
  return db;
}

// استدعها فقط عند إنهاء التطبيق
export async function disconnectFromMongoDB() {
  if (client) await client.close();
  client = null;
}
