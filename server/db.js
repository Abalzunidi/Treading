import { MongoClient } from 'mongodb';

let client = null;

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
