import { toDoc } from './csv.js';

// مخزن الصفقات فوق مجموعة MongoDB. الصفقات المغلقة تبقى للأبد حتى لو قصّ MT5 تاريخه؛
// الصفقات المفتوحة تتطابق مع آخر لقطة (تُحذف عند إغلاقها).
export function createTradesRepo(db) {
  const col = db.collection('trades');

  return {
    async init() {
      await col.createIndex({ key: 1 }, { unique: true });
      await col.createIndex({ status: 1, closeAt: -1 });
    },

    async syncSnapshot(rows) {
      const docs = rows.map(toDoc);
      const now = new Date();
      if (docs.length) {
        await col.bulkWrite(
          docs.map((d) => ({
            updateOne: {
              filter: { key: d.key },
              update: { $set: { ...d, updatedAt: now }, $setOnInsert: { createdAt: now } },
              upsert: true,
            },
          })),
          { ordered: false },
        );
      }
      const openKeys = docs.filter((d) => d.status === 'OPEN').map((d) => d.key);
      const removed = await col.deleteMany({ status: 'OPEN', key: { $nin: openKeys } });
      return { received: docs.length, openRemoved: removed.deletedCount };
    },

    async list({ status, symbol } = {}) {
      const filter = {};
      if (status === 'OPEN' || status === 'CLOSED') filter.status = status;
      if (symbol) filter.symbol = String(symbol);
      const docs = await col.find(filter).sort({ closeAt: 1, openAt: 1 }).toArray();
      return docs.map((d) => d.row);
    },
  };
}
