# خطة نقل Stock Radaar للمنصة

## المرحلة 1 — البنية الأساسية (بعد استلام المفاتيح)

1. **الاتصال بـ Supabase الحالي** (بدل Lovable Cloud) باستخدام:

- `SUPABASE_URL`, `VITE_SUPABASE_URL`

`VITE_SUPABASE_ANON_KEY` (publishable)

- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

1. تجهيز `src/integrations/supabase/client.ts` + `client.server.ts` يدوياً (لأننا مش هنستخدم Lovable Cloud).
2. تسجيل `attachSupabaseAuth` middleware في `src/start.ts` عشان الـ auth يشتغل مع server functions.
3. توليد `Database` types من الـ schema بتاعتك.

## المرحلة 2 — نقل الواجهة (React UI)

- نقل كل مكونات `src/` من المشروع القديم (Components, Pages, Hooks, Contexts).
- تحويل React Router / نظام التنقل القديم لـ TanStack Router في `src/routes/`.
- الحفاظ على Tailwind v4 + نفس التصميم (Dark minimalist).
- ربط `@google/genai` بـ **Lovable AI Gateway** بدل Gemini المباشر (مجاناً).

## المرحلة 3 — نقل الـ Backend APIs

Express routes الحالية → TanStack Server Functions:


| Express endpoint                | TanStack version                                     |
| ------------------------------- | ---------------------------------------------------- |
| `/api/sync/*`                   | `src/lib/sync.functions.ts`                          |
| `/api/products/*`               | `src/lib/products.functions.ts`                      |
| `/api/analytics/*`              | `src/lib/analytics.functions.ts`                     |
| `/api/ads-spy/*` (بدون scraper) | `src/lib/ads-spy.functions.ts` — عرض فقط             |
| `/api/settings/*`               | `src/lib/settings.functions.ts`                      |
| `/api/auth/bootstrap`           | `src/routes/api/public/bootstrap.ts` (webhook style) |
| Safka HTTP client               | `src/lib/safka.server.ts`                            |
| Kimi/Logfare client             | `src/lib/kimi.server.ts`                             |


## المرحلة 4 — الجدولة (Scheduler)

- الـ `ENABLE_INTERNAL_SCHEDULER` مش هيشتغل على Workers.
- الحل: إنشاء `src/routes/api/public/cron/sync.ts` محمي بـ `CRON_SECRET`.
- ربطه بـ **pg_cron** جوّه Supabase يستدعيه كل 20 دقيقة عبر `pg_net`.

## المرحلة 5 — الميزات المستبعدة

هتفضل في الكود بس متعطلة مع Banner واضح:

- **Ads Spy scraper** (Playwright) — يحتاج تشغيل خارجي على VPS/Cloud Run.
- **Nodemailer SMTP** — استبدال بـ Resend/SendGrid لاحقاً إن حبيت.
- **Firebase** — إزالة كاملة (Supabase كافي).

---

## المفاتيح المطلوبة منك (لما نوصل لكل مرحلة)

**قبل نبدأ (ضروري):**

1. `SUPABASE_URL` — رابط مشروع Supabase
2. `SUPABASE_SERVICE_ROLE_KEY` — المفتاح السري
3. `VITE_SUPABASE_ANON_KEY` — المفتاح العام
4. `SUPABASE_PROJECT_ID` — الـ project ref

**بعدين:**
5. `SAFKA_API_KEY` — مصدر الـ inventory
6. `LOGFARE_API_KEY` — للتحليل بـ Kimi
7. `BOOTSTRAP_SECRET` + `CRON_SECRET` — هولّدهم أنا automatically
8. `GEMINI_API_KEY` — **مش محتاج!** هنستخدم Lovable AI Gateway مجاناً

---

## ⚠️ ملاحظات مهمة

- المشروع القديم فيه **~100 ملف debug/test** (`check_*.cjs`, `fix_*.cjs`, `test_*.cjs`) — مش هنقلها.
- الـ migrations (96KB) هتتنفذ كما هي على Supabase بتاعتك (بس تأكد إنها متنفذة عندك بالفعل، وإلا هنشغّلها).
- التنفيذ الكامل هياخد **عدة رسائل** بسبب حجم المشروع.

**هل توافق على الخطة؟ ولو أيوه، ابدأ بإرسال المفاتيح الأربعة الأولى.**