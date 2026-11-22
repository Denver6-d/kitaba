# Developer notes

Detailed setup and maintenance notes for Kitaba. The project overview is in the [README](../README.md); the spec, design and decision log are in [SPEC.md](../SPEC.md), [DESIGN.md](../DESIGN.md) and [DECISIONS.md](../DECISIONS.md).

## Getting started

Requires Node.js 20.9 or later.

```
npm install
npm run dev               # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest: domain, repositories and the Dexie migration, sync, content, auth redirects |
| `npm run validate:content` | Content validator: schema, duplicates, examples, volumes, stage pools, the open-data library (hashes, credits, blocklist, a clean spell check of every sentence) |
| `npm run check:bundle` | After a build: first-load JS per page, the size budget, and that the spell checker, library data and licence notices stay off the pages that do not need them |
| `npm run content:build` | Dev-only open-data pipeline (downloads to the git-ignored `content-raw/`, writes `public/content/v1`); see DECISIONS, "Open data" |
| `npm run audio:build` | Dev-only pronunciation audio pipeline (portable tools in the git-ignored `tools/`, writes `public/audio/v1`); see below and DECISIONS, "Pronunciation audio" |

The service worker is registered in production builds only.

### Pronunciation audio

Every game word with its own Arabic hint has a short MP3 in `public/audio/v1`: a human recording from Wikimedia Commons under an open licence when a usable one exists, otherwise the public-domain Piper voice. Words without a file use the device's voice. Licences and authors are on `/credits` and in the downloadable credits list (DECISIONS AU1–AU14).

**Re-check for new human recordings every few months.** Wikimedia Commons keeps receiving recordings, so some words that use the generated voice today may get a human recording later. To pick them up:

```
npm run audio:build -- --only=index --force    # list the Commons pronunciation files again
npm run audio:build -- --only=speakers         # accents of any new Lingua Libre speakers
npm run audio:build -- --only=select           # licences and authors of new files; the new candidates per word
npm run audio:build -- --only=upgrade          # download them and replace generated files (slow, polite, resumable)
```

Then run the usual checks (`lint`, `typecheck`, `test`, `validate:content`, `build`) and commit `public/audio/v1` and `scripts/audio/speakers.json`. The upgrade can be stopped at any time and resumed later. To pause it without stopping, create `content-raw/audio/upgrade.pause` and delete it to continue.

## Optional: accounts, sync and leaderboard (Supabase)

Without configuration the app runs in guest mode, and the account and leaderboard pages say so.

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/20261117000001_progress.sql`, then `supabase/migrations/20261117000002_leaderboard.sql`.
3. Run `supabase/tests/rls_tests.sql`. It rolls back and prints `ALL RLS TESTS PASSED`. Then go through `supabase/tests/rls_checklist.md`.
4. Under **Authentication → URL Configuration**, set the Site URL and add `https://<your-site>/auth/callback**` (and `http://localhost:3000/auth/callback**` for development) to the Redirect URLs. The app adds `?next=…` to the callback, and Supabase matches the whole URL, so the trailing `**` is needed.
5. Copy `.env.example` to `.env.local` and set only the two public values: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. **Google sign-in is hidden by default.** The "Continue with Google" button appears only when `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=true` is set at build time (any other value, or none, keeps it hidden). Set it only after the Google provider is configured in Supabase (steps below). Otherwise the button would only lead to an error. The flag is public (it only controls a button) and holds no secret. Rebuild after changing it, because Next.js inlines `NEXT_PUBLIC_*` values at build time.
7. **Email sign-in is hidden by default.** Email and password sign-in and sign-up, the magic link and the password reset appear only when `NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN=true` is set at build time (any other value, or none, keeps them hidden). Supabase's built-in mailer only sends to the project's own members, so set up a custom SMTP server first (**Authentication → Emails → SMTP Settings**), or real visitors never receive their confirmation or sign-in emails. With email off and Google on, the account page shows only "Continue with Google". With both off, it says accounts are not available yet. The email code and its tests stay in place. Rebuild after changing the flag.

**Never put a `service_role` key, or any OAuth client secret, in this repo, in `.env` files or in the client.** Account deletion uses a `SECURITY DEFINER` function that can only delete the caller.

## تفعيل الدخول بحساب Google

هذه الخطوات تُنفَّذ مرة واحدة. **لا تضع معرّف العميل (Client ID) ولا السرّ (Client Secret) في الكود ولا في ملفات ‎.env**؛ مكانهما الوحيد هو لوحة تحكم Supabase.

### أولًا: احصل على رابط الرجوع (Callback URL) من Supabase
1. افتح مشروعك في Supabase، ثم **Authentication ← Sign In / Providers ← Google**.
2. ستجد حقلًا باسم **Callback URL (for OAuth)**، وشكله:
   `https://<معرّف-مشروعك>.supabase.co/auth/v1/callback`
   انسخه كما هو، فهو الرابط الذي ستلصقه في Google.

### ثانيًا: أنشئ عميل OAuth في Google Cloud Console
1. ادخل إلى <https://console.cloud.google.com/> وأنشئ مشروعًا جديدًا (أو اختر مشروعًا موجودًا).
2. من القائمة: **Google Auth Platform** (كان اسمها سابقًا APIs & Services ← OAuth consent screen). في **Branding** اكتب اسم التطبيق وبريد الدعم، وأضف في **Authorized domains** النطاق `<معرّف-مشروعك>.supabase.co` ونطاق موقعك. وفي **Audience** اختر **External**. احفظ.
3. **مهم:** التطبيق الجديد يكون في وضع **Testing**، فلا يستطيع الدخول إلا من تضيفهم في **Test users**. عندما تريد فتحه للجميع، اضغط **Publish app** في صفحة **Audience** ليصبح **In production**.
4. انتقل إلى **Google Auth Platform ← Clients ← Create client** (أو **APIs & Services ← Credentials ← Create Credentials ← OAuth client ID**).
5. في **Application type** اختر **Web application**.
6. في **Authorized JavaScript origins** أضف عنوان موقعك، مثل `https://your-site.com` (و`http://localhost:3000` للتجربة).
7. في **Authorized redirect URIs** الصق رابط Supabase الذي نسخته في الخطوة الأولى بالضبط:
   `https://<معرّف-مشروعك>.supabase.co/auth/v1/callback`
8. اضغط **Create**، فيظهر لك **Client ID** و**Client Secret**.

### ثالثًا: أدخل المعرّف والسرّ في Supabase
1. ارجع إلى **Authentication ← Sign In / Providers ← Google** في Supabase.
2. فعّل **Enable Sign in with Google**.
3. الصق **Client ID** في حقل Client IDs، و**Client Secret** في حقل Client Secret، ثم اضغط **Save**.
4. تأكّد أن **Authentication ← URL Configuration ← Redirect URLs** يحتوي على `https://your-site.com/auth/callback**` و`http://localhost:3000/auth/callback**` للتجربة (النجمتان في النهاية ضروريتان لأن التطبيق يضيف `?next=` إلى الرابط). التطبيق لا يعيد المستخدم إلا إلى هذا الرابط على موقعه نفسه.

### رابعًا: أظهر زر Google
زر «المتابعة باستخدام Google» **مخفي افتراضيًا**. بعد إكمال الخطوات السابقة، أضف إلى ملف ‎`.env.local` (أو إلى إعدادات البيئة في الاستضافة) السطر `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=true`، ثم أعد البناء (`npm run build`)، لأن قيم ‎`NEXT_PUBLIC_*` تُضمَّن وقت البناء. أي قيمة أخرى، أو ترك السطر فارغًا، تُبقي الزر مخفيًا. هذا المتغير عام ولا يحمل أي سرّ.

الدخول بالبريد الإلكتروني (إنشاء حساب وتسجيل الدخول بكلمة مرور، ورابط الدخول، واستعادة كلمة المرور) **مخفي افتراضيًا** أيضًا، ولا يظهر إلا مع `NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN=true` ثم إعادة البناء. خدمة البريد المدمجة في Supabase لا ترسل إلا إلى أعضاء المشروع، فأعدّ خادم SMTP خاصًا أولًا (**Authentication ← Emails ← SMTP Settings**) قبل تفعيله. إن كان البريد مطفأً وGoogle مفعّلًا، تعرض صفحة الحساب زر «المتابعة باستخدام Google» وحده دون فاصل «أو». وإن كان الاثنان مطفأين، تعرض الصفحة رسالة بأن الحسابات غير متاحة بعد.

### للتجربة
افتح صفحة **الحساب** في الموقع واضغط «المتابعة باستخدام Google» (بعد تفعيل الزر كما في الخطوة الرابعة). بعد الموافقة تعود إلى `/auth/callback` ثم إلى صفحة الحساب. إن كان على الجهاز تقدّم سابق، يسألك التطبيق هل تدمجه مع حسابك أم لا. وإذا ضغطت «إلغاء» في شاشة Google، تظهر رسالة هادئة ويبقى تقدّمك محفوظًا.

## Source layout

```
src/app            routes (thin)
src/features       React features: games, writing, levels, library, audio, account, leaderboard, rewards, landing
src/domain         pure TypeScript: game engine, items, misspellings, campaign, SRS, merge rules
src/repositories   interfaces + RecordStore backends (Dexie with versioned migrations, in-memory, Supabase), outbox
src/data           hand-written spelling content (one file per category), rules, credits, schemas, validator
src/config/brand.ts  the product name
scripts/           open-data and audio pipelines, CSP hashes, bundle report
public/content/v1  open-data library (lazy-loaded)
public/audio/v1    pronunciation MP3s and their credits list
supabase/          migrations and RLS tests
tests/             Vitest suites
```

