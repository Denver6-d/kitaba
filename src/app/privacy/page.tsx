"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { Page } from "@/components/page";

interface Section {
  readonly title: string;
  readonly items: readonly string[];
}

const CONTENT: Record<"ar" | "en", { intro: string; sections: readonly Section[]; updated: string }> = {
  ar: {
    intro: "كتابة مصممة لتعمل دون أن تعرف عنك شيئًا. هذه الصفحة تذكر بالضبط ما يُحفظ، وأين، وكيف تحذفه.",
    sections: [
      {
        title: "على جهازك (دائمًا)",
        items: [
          "نتائج اختبارات الكتابة: السرعة والدقة والثبات والتاريخ، وأفضل محاولة لكل وضع (للسباق مع الشبح).",
          "إحصاءات المفاتيح: عدد الضغطات الصحيحة والخاطئة لكل حرف.",
          "بطاقات الإملاء للمراجعة المتباعدة، ومحاولات الجمل (بما فيها النص الذي كتبته)، ورسائلك في الكتابة المهنية.",
          "أيام التمرين والنقاط، والإنجازات، ومستواك المبدئي وخطتك وهدفك اليومي.",
          "الإعدادات (اللغة، المظهر، حجم الخط…) في localStorage.",
          "كل ذلك في قاعدة IndexedDB داخل متصفحك. لا يُرسل إلى أي مكان إن لم تسجّل الدخول.",
        ],
      },
      {
        title: "في السحابة (فقط إذا أنشأت حسابًا)",
        items: [
          "بريدك الإلكتروني وكلمة المرور (مشفّرة) لدى خدمة المصادقة Supabase Auth.",
          "نسخة من سجلات التقدّم المذكورة أعلاه لمزامنتها بين أجهزتك. كل صف مرتبط بحسابك، وقواعد قاعدة البيانات (Row Level Security) تمنع أي مستخدم آخر من قراءته.",
          "ملفات تعريف الارتباط الوحيدة هي ملفات جلسة تسجيل الدخول التي تحتاجها Supabase.",
        ],
      },
      {
        title: "لوحة الصدارة (فقط إذا اشتركت)",
        items: [
          "يظهر للعامة: اسمك المستعار، وأفضل سرعة، والدقة، وتاريخ النتيجة. لا يظهر بريدك ولا معرّف حسابك أبدًا.",
          "يمكنك مغادرة اللوحة في أي وقت، فتُحذف نتائجك منها فورًا.",
        ],
      },
      {
        title: "ما لا نفعله",
        items: [
          "لا تحليلات، ولا تتبّع، ولا إعلانات، ولا أدوات طرف ثالث.",
          "الخطوط محمّلة مع الموقع نفسه، فلا طلبات إلى Google Fonts أثناء الاستخدام.",
          "النطق يستخدم أصوات جهازك فقط؛ نتجنب الأصوات التي ترسل النص إلى خوادم خارجية.",
          "لا يوجد ذكاء اصطناعي: التصحيح يتم بقواعد داخل متصفحك.",
        ],
      },
      {
        title: "كيف تحذف بياناتك",
        items: [
          "على هذا الجهاز: الإعدادات ← «حذف كل بياناتي من هذا الجهاز».",
          "في السحابة: الحساب ← «احذف حسابي وبياناتي». يحذف الحساب وكل سجلاته ونتائج لوحة الصدارة نهائيًا.",
          "يمكنك تصدير كل بياناتك بصيغة JSON من الإعدادات أو من صفحة الحساب قبل الحذف.",
        ],
      },
    ],
    updated: "آخر تحديث: نوفمبر 2026",
  },
  en: {
    intro: "Kitaba is designed to work without knowing anything about you. This page lists exactly what is stored, where, and how to delete it.",
    sections: [
      {
        title: "On your device (always)",
        items: [
          "Typing test results: speed, accuracy, consistency and date, plus your best run per mode (for the ghost race).",
          "Key statistics: correct and missed presses per key.",
          "Spelling review cards, sentence attempts (including the text you typed), and your professional-writing messages.",
          "Practice days and points, achievements, your starting level, plan and daily goal.",
          "Settings (language, theme, text size…) in localStorage.",
          "All of this lives in an IndexedDB database in your browser. Nothing is sent anywhere unless you sign in.",
        ],
      },
      {
        title: "In the cloud (only if you create an account)",
        items: [
          "Your email address and password (hashed) with the Supabase Auth service.",
          "A copy of the progress records above, to sync them across your devices. Every row is tied to your account, and database rules (Row Level Security) stop any other user from reading it.",
          "The only cookies are the sign-in session cookies Supabase needs.",
        ],
      },
      {
        title: "Leaderboard (only if you join)",
        items: [
          "Public: your nickname, best speed, accuracy and the date of the score. Your email and account id are never shown.",
          "You can leave the board at any time; your scores are removed from it immediately.",
        ],
      },
      {
        title: "What we do not do",
        items: [
          "No analytics, no tracking, no ads, no third-party tools.",
          "Fonts are served with the site itself, so there are no requests to Google Fonts while you use it.",
          "Speech uses your device's own voices only; we avoid voices that send text to outside servers.",
          "No AI: feedback comes from rules that run in your browser.",
        ],
      },
      {
        title: "How to delete your data",
        items: [
          "On this device: Settings → “Delete all my data on this device”.",
          "In the cloud: Account → “Delete my account and data”. This permanently deletes the account, all of its records and its leaderboard scores.",
          "You can export everything as JSON from Settings or the Account page before deleting.",
        ],
      },
    ],
    updated: "Last updated: November 2026",
  },
};

export default function PrivacyPage() {
  const { t, lang } = useI18n();
  const c = CONTENT[lang];
  const other = lang === "ar" ? "en" : "ar";
  return (
    <Page title={t.privacy.title} intro={c.intro} width="narrow">
      <div className="space-y-10">
        {c.sections.map((s) => (
          <section key={s.title} className="space-y-3">
            <h2 className="text-xl font-semibold">{s.title}</h2>
            <ul className="list-disc space-y-2 ps-5 text-ink-soft marker:text-brass-fill">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-sm text-ink-soft">{c.updated}</p>
        <details className="rounded-xl border border-rule p-4" lang={other} dir={other === "ar" ? "rtl" : "ltr"}>
          <summary className="cursor-pointer font-medium">{other === "ar" ? "النسخة العربية" : "English version"}</summary>
          <div className="mt-4 space-y-6">
            <p>{CONTENT[other].intro}</p>
            {CONTENT[other].sections.map((s) => (
              <section key={s.title} className="space-y-2">
                <h3 className="font-semibold">{s.title}</h3>
                <ul className="list-disc space-y-1 ps-5 text-sm text-ink-soft">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
        <Link href="/settings" className="inline-block text-brass underline underline-offset-4">
          {t.nav.settings}
        </Link>
      </div>
    </Page>
  );
}
