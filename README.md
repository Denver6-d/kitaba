# Kitaba: master English spelling

Short spelling games for Arabic speakers (A1–C1). Learners listen and spell, fix the mistake, fill in missing letters, unscramble words and pick the right spelling. They work through 8 worlds × 10 stages and a daily challenge, and their own mistakes come back on a spaced-repetition schedule. The UI is Arabic first (RTL), with an English toggle.

The product name lives in one place: `src/config/brand.ts`.

- **Spelling only.** Every screen serves one question: can the learner spell the word? After each mistake, feedback shows a letter diff and the rule in one line.
- **Guest-first.** Everything works with no account, and offline after the first visit. Progress is stored in IndexedDB on the device.
- **Optional account:** email, and Google once it is set up and switched on (`NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=true`). It adds cloud sync across devices and an opt-in weekly leaderboard.
- **No analytics, no tracking, no AI APIs.** The only network calls go to Supabase, and only when it is configured.

See [SPEC.md](SPEC.md), [DESIGN.md](DESIGN.md) and [DECISIONS.md](DECISIONS.md). The pivot from the earlier typing and writing product is in DECISIONS, section "Pivot".

## Features

| Area | What it does |
|---|---|
| Content | 1,591 original words in 15 categories (double letters, silent letters, ie/ei, plurals, -ed/-ing, -ly, prefixes, suffixes, British/American, homophones, p/b, v/f, short vowels, e/i/a confusion, commonly misspelled). Every word has an Arabic hint and an example sentence. There are 1,589 dictation sentences. |
| Modes | Listen and Spell, Spelling Bee (60 s, combo multiplier), Fix the Mistake, Missing Letters, Word Scramble, Pick the Right Spelling, Review (SM-2). |
| Campaign | 8 worlds × 10 stages, 1–3 stars, unlocks, a boss per world (mixed modes and dictated sentences), a daily challenge, XP and levels, streaks, achievements. |
| No repeats | A shuffle-bag per word pool, so a word only comes back once the pool is used up. |
| Accents | American or British English (voice and expected spelling), using on-device voices only. |
| Accounts | Google OAuth behind a public flag (off by default), email and password, magic link. Offline-tolerant sync, merging on first sign-in, export, account deletion. |
| Leaderboard | Weekly points, opt-in nickname, server-side plausibility checks. |
| Platform | One dark design (calm, one gold accent), Western digits in both languages, text size, a reading-friendly font, reduced motion, optional sounds and vibration (off by default), an installable PWA, phone and desktop layouts. |

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

The service worker is registered in production builds only.

## Optional: accounts, sync and leaderboard (Supabase)

Without configuration the app runs in guest mode, and the account and leaderboard pages say so.

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/20261117000001_progress.sql`, then `supabase/migrations/20261117000002_leaderboard.sql`.
3. Run `supabase/tests/rls_tests.sql`. It rolls back and prints `ALL RLS TESTS PASSED`. Then go through `supabase/tests/rls_checklist.md`.
4. Under **Authentication → URL Configuration**, set the Site URL and add `https://<your-site>/auth/callback**` (and `http://localhost:3000/auth/callback**` for development) to the Redirect URLs. The app adds `?next=…` to the callback, and Supabase matches the whole URL, so the trailing `**` is needed.
5. Copy `.env.example` to `.env.local` and set only the two public values: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. **Google sign-in is hidden by default.** The "Continue with Google" button appears only when `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=true` is set at build time (any other value, or none, keeps it hidden). Set it only after the Google provider is configured in Supabase (steps below). Otherwise the button would only lead to an error. Email sign-in is always shown when Supabase is configured. The flag is public (it only controls a button) and holds no secret. Rebuild after changing it, because Next.js inlines `NEXT_PUBLIC_*` values at build time.

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
زر «المتابعة باستخدام Google» **مخفي افتراضيًا**. بعد إكمال الخطوات السابقة، أضف إلى ملف ‎`.env.local` (أو إلى إعدادات البيئة في الاستضافة) السطر `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=true`، ثم أعد البناء (`npm run build`)، لأن قيم ‎`NEXT_PUBLIC_*` تُضمَّن وقت البناء. أي قيمة أخرى، أو ترك السطر فارغًا، تُبقي الزر مخفيًا. الدخول بالبريد الإلكتروني يظهر دائمًا عند إعداد Supabase. هذا المتغير عام ولا يحمل أي سرّ.

### للتجربة
افتح صفحة **الحساب** في الموقع واضغط «المتابعة باستخدام Google» (بعد تفعيل الزر كما في الخطوة الرابعة). بعد الموافقة تعود إلى `/auth/callback` ثم إلى صفحة الحساب. إن كان على الجهاز تقدّم سابق، يسألك التطبيق هل تدمجه مع حسابك أم لا. وإذا ضغطت «إلغاء» في شاشة Google، تظهر رسالة هادئة ويبقى تقدّمك محفوظًا.

## Architecture

```
src/app            routes (thin)
src/features       React features: games, account, leaderboard, rewards, landing
src/domain         pure TypeScript: game engine, items, misspellings, campaign, SRS, merge rules
src/repositories   interfaces + RecordStore backends (Dexie v2, in-memory, Supabase), outbox
src/data           spelling content (one file per category), rules, schemas, validator
src/config/brand.ts  the product name
supabase/          migrations and RLS tests
tests/             Vitest suites
```

## Licence of content

All words, Arabic hints, example sentences and rule texts were written for this project. Nothing was copied from word lists or books.
