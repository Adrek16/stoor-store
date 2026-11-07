# دليل نشر موقع العملاء (stoor) على الإنترنت

**التاريخ:** 7 نوفمبر 2026
**المشروع:** واجهة العملاء — Next.js 16
**النسخة المطلوبة:** Node.js 20.9 أو أحدث (مُختبرة على Node 22)

---

## 1. المتطلبات قبل النشر

| المتطلب | التفاصيل |
|---|---|
| Supabase | نفس المشروع الحالي `lmxmqmrbvchdxpzrumcx` |
| Storage | bucket باسم `product-images` ويجب أن يكون **Public** |
| المتغيرات | القيم موجودة في `.env.local` محلياً — لا تُرفع إلى Git |
| النطاق | دومين أو subdomain من اختيارك (مثال: `shop.example.com`) |

### متغيرات البيئة المطلوبة

| المتغير | الغرض |
|---|---|
| `SESSION_SECRET` | توقيع كوكيز العميل والطلبات — سرّي |
| `SUPABASE_URL` | عنوان مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | نفس العنوان — يُستخدم لروابط الصور |
| `SUPABASE_SERVICE_ROLE_KEY` | قراءة المنتجات والطلبات — **سرّي، خادم فقط** |
| `SUPABASE_ANON_KEY` | تسجيل ودخول العملاء عبر Supabase Auth |
| `STORE_REVALIDATE_SECRET` | نفس السر المضبوط في لوحة المدير |

> ⚠️ لا تضع `SUPABASE_SERVICE_ROLE_KEY` في أي متغير يبدأ بـ `NEXT_PUBLIC_`.

---

## 2. الخيار الموصى به — Netlify (مجاني)

الخطة المجانية تعطي 100 GB نقل شهرياً، SSL، ونطاق `*.netlify.app`.

### أ) من مستودع GitHub (النشر التلقائي)

1. افتح [app.netlify.com/start](https://app.netlify.com/start) وسجّل الدخول بـ GitHub.
2. اختر المستودع `Adrek16/stoor-store`.
3. Netlify يقرأ `netlify.toml` تلقائياً: أمر البناء `npm run build`، Node 22.
4. أضف المتغيرات الستة من **Site configuration → Environment variables**.
5. اضغط **Deploy**.

كل `git push` على `main` يعيد النشر تلقائياً.

### ب) من الجهاز (Netlify CLI)

```bash
npm install -g netlify-cli
netlify login
netlify link --id <project-id>
netlify env:set SESSION_SECRET "..." --context production
netlify deploy --build --prod
```

> `netlify deploy --build` يشغّل البناء محلياً ويرفع الناتج — لا يحتاج وصول Netlify إلى GitHub.

### ملاحظات خاصة بـ Netlify

- ملف `netlify.toml` يضبط `NODE_VERSION=22`.
- `next.config.ts` يتجاهل `output: "standalone"` عندما يضبط Netlify المتغير `NETLIFY=true`،
  لأن Netlify يستخدم محوّل OpenNext الخاص به.
- بعد أول نشر: انسخ رابط الموقع إلى `STORE_URL` و`STORE_REVALIDATE_URL` في لوحة المدير.

---

## 3. الخيار ب — Vercel

1. ارفع المشروع إلى مستودع GitHub خاص.
2. افتح [vercel.com](https://vercel.com) → **Add New Project** → اختر المستودع.
3. إعدادات المشروع:
   - Framework Preset: **Next.js**
   - Build Command: `npm run build`
   - Output Directory: اتركه فارغاً (Vercel يتعامل معه تلقائياً)
   - Node.js Version: **22.x**
4. أضف متغيرات البيئة الستة أعلاه في **Settings → Environment Variables** لكل من Production وPreview.
5. اضغط **Deploy**.
6. بعد النجاح: **Settings → Domains** → أضف الدومين واتبع تعليمات DNS.
7. غيّر في لوحة المدير:
   - `STORE_URL` = رابط المتجر العام
   - `STORE_REVALIDATE_URL` = `https://<domain>/api/revalidate`
   - `STORE_REVALIDATE_SECRET` = نفس القيمة في Vercel

> ملاحظة: `output: "standalone"` في `next.config.ts` لا يضر Vercel؛ Vercel يتجاهله ويستخدم بنيته الخاصة.

---

## 4. الخيار ج — استضافة Node عادية (VPS / خادم)

### أ) من حزمة standalone الجاهزة

1. ارفع `stoor-client-standalone-2026-11-07.zip` إلى الخادم وفكّ الضغط.
2. انسخ `.env.example` إلى `.env` واملأ القيم.
3. شغّل:

```bash
node --env-file=.env server.js
```

4. افتح المنفذ 3000 (أو غيّره بـ `PORT`).

### ب) من نسخة المصدر

```bash
npm ci
npm run build
npm start
```

> يجب ضبط متغيرات البيئة **قبل** `npm run build` لأن بعض الصفحات تُبنى مسبقاً ببيانات Supabase.

### ج) تشغيل دائم مع PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### د) Nginx + SSL

```nginx
server {
    listen 80;
    server_name shop.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

ثم:

```bash
sudo certbot --nginx -d shop.example.com
```

---

## 5. الخيار د — cPanel / لوحة استضافة

1. ابحث عن **Setup Node.js App**.
2. Application root: مجلد المشروع.
3. Application startup file: `server.js` (نسخة standalone) أو استخدم `npm start` مع نسخة المصدر.
4. Node version: 20 أو 22.
5. أضف متغيرات البيئة من واجهة cPanel.
6. أعد تشغيل التطبيق.

> بعض لوحات cPanel لا تدعم Next.js 16 الحديث؛ إن ظهرت مشاكل استخدم VPS أو Vercel.

---

## 6. ربط لوحة المدير بالموقع المنشور

لوحة المدير تعمل محلياً، لكنها تحتاج معرفة رابط المتجر العام لإرسال إشعار التحديث:

| المتغير في مشروع «مدير» | القيمة بعد النشر |
|---|---|
| `STORE_URL` | `https://shop.example.com` |
| `STORE_REVALIDATE_URL` | `https://shop.example.com/api/revalidate` |
| `STORE_REVALIDATE_SECRET` | نفس سر Vercel/الخادم |

بعد التعديل أعد تشغيل لوحة المدير. أي تعديل منتج أو تصنيف أو نص سيظهر في المتجر فوراً.

---

## 7. قائمة فحص بعد النشر

- [ ] الصفحة الرئيسية تفتح وتعرض المنتجات الحقيقية.
- [ ] صور المنتجات تظهر (وليست الرسوم البديلة).
- [ ] صفحة منتج + اختيار اللون/المقاس يعمل.
- [ ] البحث يعمل بالعربية.
- [ ] السلة وإتمام الطلب يعملان.
- [ ] `/sitemap.xml` و`/robots.txt` يفتحان.
- [ ] اسم المتجر والهاتف والواتساب في «معلومات المتجر» صحيحة.
- [ ] تسجيل عميل جديد يعمل.
- [ ] رابط إعادة التحقق من لوحة المدير يرجع `200`.
- [ ] شهادة SSL مفعّلة (https).

---

## 8. أمان

- لا ترفع `.env.local` أو `.env` إلى Git أو داخل حزمة المصدر.
- حزمة المصدر لا تحتوي أي ملف بيئة.
- سر `SERVICE_ROLE` يبقى على الخادم فقط.
- يُفضّل تدوير `SESSION_SECRET` و`STORE_REVALIDATE_SECRET` قبل الإطلاق الفعلي.

---

## 9. ملاحظات فنية

- `experimental.cpus: 1` ضروري أثناء البناء لأن Supabase يحدّ الاتصالات المتزامنة.
- العميل يستخدم `node:https` مع طابور 4 طلبات وإعادة محاولة، ويعمل على أي استضافة Node.
- الصور تُقدَّم مباشرة من Supabase Storage وليس من الخادم.
