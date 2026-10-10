# Treading — دفتر التداول

واجهة + خادم صغير + قاعدة MongoDB لعرض صفقات حساب MetaTrader 5 (مفتوحة ومغلقة، منحنى أداء، نسبة فوز).

```
frontend/   الواجهة (HTML/CSS/JS عادي، بدون build)
server/     خادم Express + MongoDB + استيراد تلقائي لملف المنصة
test/       اختبارات (node --test)
```

## كيف تعمل

```
MT5 (المؤشر GoldMarketAnalyzer) ──يكتب──> Common\Files\trade_journal.csv
                                              │  (الخادم يراقبه كل 3 ثوانٍ)
                                              ▼
                              MongoDB Atlas (مجموعة trades)
                                              │
                          الواجهة ──GET /api/trades──┘
```

- الصفقات **المغلقة تبقى في قاعدة البيانات للأبد** حتى لو قصّت المنصة تاريخها.
- الصفقات **المفتوحة** تتطابق مع آخر لقطة وتُحذف عند إغلاقها.
- بدون الخادم، افتح `frontend/index.html` من القرص مباشرة وتقرأ الصفحة ملف المؤشر المحلي.

## التشغيل

```bash
npm install
cp .env.example .env     # ثم املأ MONGODB_PASSWORD
npm start                # http://127.0.0.1:3000
npm test
```

في `.env`: ضع كلمة سر مستخدم Atlas في `MONGODB_PASSWORD` (يرمّزها الخادم تلقائياً، فلا مشكلة مع الرموز الخاصة).
ملف `.env` **لا يُرفع إلى git**.

في Atlas: **Network Access** أضف عنوان IP جهازك، وتأكد أن المستخدم له صلاحية قراءة/كتابة.

## الأمان

- الخادم يستمع على `127.0.0.1` افتراضياً (جهازك فقط).
- لو غيّرت `HOST=0.0.0.0` للوصول من الجوال، **لازم** تضبط `API_TOKEN`، وإلا يرفض الخادم التشغيل.
  الصفحة تسأل عن الرمز مرة وتحفظه في المتصفح.
- لا تنشر الخادم على الإنترنت بدون HTTPS (مثلاً خلف Cloudflare Tunnel أو Caddy).

## الواجهات

| المسار | الوصف |
|--------|-------|
| `GET /api/health` | فحص الحياة (بدون رمز) |
| `GET /api/trades?status=OPEN\|CLOSED&symbol=EURUSDm` | الصفقات |
| `POST /api/trades/sync` | يستقبل نص CSV (`Content-Type: text/csv`) ويحدّث القاعدة |
