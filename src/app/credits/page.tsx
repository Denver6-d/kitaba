"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { Page } from "@/components/page";
import { PRODUCT_NAME } from "@/config/brand";
import { CONTENT_BASE, getLibrary } from "@/features/library/library";
import { AUDIO_BASE, getAudioLibrary } from "@/features/audio/audio-library";
import { CMUDICT_NOTICE, DICTIONARY_EN_NOTICE, SCOWL_NOTICE, VARCON_NOTICE } from "@/data/credits/notices.generated";

interface Source {
  readonly name: string;
  readonly href: string;
  readonly licence: string;
  readonly licenceHref: string;
  readonly use: { readonly ar: string; readonly en: string };
}

/** The sources used, as recorded in scripts/content/sources.json (DECISIONS OD1). */
const SOURCES: readonly Source[] = [
  {
    name: "Tatoeba",
    href: "https://tatoeba.org/",
    licence: "CC BY 2.0 FR",
    licenceHref: "https://creativecommons.org/licenses/by/2.0/fr/",
    use: {
      ar: "جمل الإملاء وأمثلة الكلمات، وترجماتها العربية المرتبطة بها، وتكرار الكلمات لترتيبها. اخترنا الجمل بمرشّحات (الجودة، والطول، والمحتوى، والأسماء) وغيّرنا علامات الاقتباس والمسافات فقط. اسم كاتب كل جملة ورابطها يظهران بجانبها.",
      en: "Dictation sentences and word examples, their linked Arabic translations, and word frequencies for ranking. Sentences were selected by filters (quality, length, content, names); only typographic quotes and spaces were changed. Each sentence shows its author and a link next to it.",
    },
  },
  {
    name: "SCOWL (Spell Checker Oriented Word Lists) 2020.12.07",
    href: "http://wordlist.aspell.net/",
    licence: "SCOWL licence (MIT-like), with public-domain, Ispell and WordNet parts",
    licenceHref: "#notice-scowl",
    use: {
      ar: "قائمة الكلمات المرشّحة ودرجة شيوعها، وقوائم الأسماء والاختصارات والكلمات المسيئة لاستبعادها.",
      en: "The candidate word list and its commonness levels, and the lists of names, abbreviations and offensive words used to leave words out.",
    },
  },
  {
    name: "VarCon 2020.12.07",
    href: "http://wordlist.aspell.net/varcon/",
    licence: "VarCon licence (MIT-like) and the Ispell licence",
    licenceHref: "#notice-varcon",
    use: {
      ar: "أزواج التهجئة الأمريكية والبريطانية (color / colour). استخرجنا هذه الأزواج فقط، فالبيانات المشتقّة معدّلة.",
      en: "American and British spelling pairs (color / colour). Only these pairs were extracted, so the derived data is modified.",
    },
  },
  {
    name: "dictionary-en 4.0.0 (Hunspell en-US from SCOWL)",
    href: "https://github.com/wooorm/dictionaries",
    licence: "MIT and the SCOWL licence",
    licenceHref: "#notice-dictionary-en",
    use: {
      ar: "قاموس التدقيق الإملائي على جهازك، والتحقّق من صحة كل كلمة وجملة.",
      en: "The on-device spell-check dictionary, and the check that every word and sentence is spelled correctly.",
    },
  },
  {
    name: "CMU Pronouncing Dictionary",
    href: "https://github.com/cmusphinx/cmudict",
    licence: "BSD-2-Clause-style (Carnegie Mellon University)",
    licenceHref: "#notice-cmudict",
    use: {
      ar: "اكتشاف الكلمات المتشابهة في النطق والحروف الصامتة. لا ننشر النطق نفسه.",
      en: "Finding sound-alike words and silent letters. The pronunciations themselves are not published.",
    },
  },
  {
    name: "Wikimedia Commons: English pronunciation recordings (En-us files and Lingua Libre)",
    href: "https://commons.wikimedia.org/wiki/Category:U.S._English_pronunciation",
    licence: "Per file: CC BY-SA 3.0 or 4.0, CC BY 3.0 or 4.0, CC0, or public domain",
    licenceHref: "#audio-list",
    use: {
      ar: "تسجيلات بأصوات بشرية لنطق الكلمات بلكنة أمريكية. قصصنا الصمت في أولها وآخرها، وعدّلنا مستوى الصوت، وحوّلناها إلى MP3. اسم صاحب كل تسجيل ورخصته يظهران بعد الإجابة وفي القائمة أدناه، والملفات المعدّلة تحت رخصة الملف الأصلي نفسها.",
      en: "Human recordings of the words in an American accent. We trimmed the silence at both ends, normalised the loudness and converted them to MP3. Each recording's author and licence are shown after the answer and in the list below; the changed files keep the original file's licence.",
    },
  },
  {
    name: "Piper text-to-speech, voice en_US-ljspeech-high",
    href: "https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ljspeech/high",
    licence: "Public domain (voice trained on the public-domain LJ Speech dataset)",
    licenceHref: "https://keithito.com/LJ-Speech-Dataset/",
    use: {
      ar: "نطق مولَّد على جهاز التطوير للكلمات التي لا يوجد لها تسجيل بشري برخصة مناسبة. إن لم يوجد ملف، يستخدم الموقع صوت جهازك.",
      en: "Pronunciation generated offline, on the development machine, for words with no human recording under a suitable licence. Where there is no file, the site uses your device's voice.",
    },
  },
];

const TEXT = {
  ar: {
    intro: `يستخدم ${PRODUCT_NAME} بيانات مفتوحة تسمح رخصها بهذا الاستخدام، إلى جانب محتوى كتبناه بأنفسنا. هذه الصفحة تذكر كل مصدر ورخصته وما أخذناه منه، وتعيد نشر نصوص الرخص كما تطلب.`,
    sources: "المصادر",
    licence: "الرخصة",
    ours: "محتوانا",
    oursBody:
      "بنك الكلمات الأساسي، والتلميحات العربية، والجمل والرسائل والمواقف، وبعض أمثلة الكلمات كُتبت لهذا المشروع. لا ننسخ من الكتب أو القوائم المحمية بحقوق النشر.",
    tatoebaList: "قائمة جمل تاتويبا وكتّابها",
    tatoebaListBody: "كل جملة مستخدمة من تاتويبا، ولغتها، واسم كاتبها، في ملف نصي واحد.",
    download: "نزّل القائمة",
    audioList: "تسجيلات النطق ومصادرها",
    audioListBody: "كل ملف صوتي، ومصدره (تسجيل بشري أو صوت مولَّد)، واسم صاحبه، ورخصته، ورابط الملف الأصلي، في ملف نصي واحد.",
    notices: "نصوص الرخص",
    noticesBody: "تطلب هذه المصادر إعادة نشر إشعاراتها كما هي. النصوص التالية منقولة حرفيًا وبلغتها الأصلية.",
  },
  en: {
    intro: `${PRODUCT_NAME} uses open data whose licences allow this use, alongside content we wrote ourselves. This page names every source, its licence and what we took from it, and reproduces the licence notices as they require.`,
    sources: "Sources",
    licence: "Licence",
    ours: "Our own content",
    oursBody:
      "The core word bank, the Arabic hints, the sentences, messages and scenarios, and some word examples were written for this project. Nothing is copied from copyrighted books or word lists.",
    tatoebaList: "Tatoeba sentences and their authors",
    tatoebaListBody: "Every Tatoeba sentence used, its language and its author's name, in one text file.",
    download: "Download the list",
    audioList: "Pronunciation recordings and their sources",
    audioListBody: "Every audio file, its source (a human recording or the generated voice), its author, its licence and a link to the original file, in one text file.",
    notices: "Licence notices",
    noticesBody: "These sources ask for their notices to be reproduced as they are. The texts below are copied word for word, in their original language.",
  },
} as const;

const NOTICES = [
  { id: "notice-scowl", title: "SCOWL", text: SCOWL_NOTICE },
  { id: "notice-varcon", title: "VarCon", text: VARCON_NOTICE },
  { id: "notice-dictionary-en", title: "dictionary-en", text: DICTIONARY_EN_NOTICE },
  { id: "notice-cmudict", title: "CMU Pronouncing Dictionary", text: CMUDICT_NOTICE },
] as const;

export default function CreditsPage() {
  const { t, lang } = useI18n();
  const c = TEXT[lang];
  const [listHref, setListHref] = useState<string | null>(null);
  const [audioHref, setAudioHref] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getLibrary()
      .manifest()
      .then((m) => {
        const f = m?.files["tatoeba-credits"];
        if (alive && f) setListHref(CONTENT_BASE + f.path);
      });
    void getAudioLibrary()
      .manifest()
      .then((m) => {
        if (alive && m) setAudioHref(AUDIO_BASE + m.credits.path);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Page title={t.nav.credits} intro={c.intro} width="narrow">
      <div className="space-y-12">
        <section className="space-y-4" aria-labelledby="src-h">
          <h2 id="src-h" className="text-2xl font-light">
            {c.sources}
          </h2>
          <ul className="space-y-4">
            {SOURCES.map((s) => (
              <li key={s.name} className="panel space-y-2 p-5">
                <p className="font-semibold" dir="ltr" lang="en">
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {s.name}
                  </a>
                </p>
                <p className="text-sm">
                  <span className="text-fg-2">{c.licence}: </span>
                  <a href={s.licenceHref} {...(s.licenceHref.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="underline underline-offset-4" dir="ltr" lang="en">
                    {s.licence}
                  </a>
                </p>
                <p className="text-fg-2">{s.use[lang]}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3" aria-labelledby="tl-h">
          <h2 id="tl-h" className="text-2xl font-light">
            {c.tatoebaList}
          </h2>
          <p className="text-fg-2">{c.tatoebaListBody}</p>
          {listHref && (
            <a href={listHref} download="tatoeba-credits.tsv" className="inline-flex min-h-11 items-center rounded-md border border-line px-4 font-medium hover:bg-muted">
              {c.download}
            </a>
          )}
        </section>

        <section id="audio-list" className="space-y-3" aria-labelledby="al-h">
          <h2 id="al-h" className="text-2xl font-light">
            {c.audioList}
          </h2>
          <p className="text-fg-2">{c.audioListBody}</p>
          {audioHref && (
            <a href={audioHref} download="audio-credits.tsv" className="inline-flex min-h-11 items-center rounded-md border border-line px-4 font-medium hover:bg-muted">
              {c.download}
            </a>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="own-h">
          <h2 id="own-h" className="text-2xl font-light">
            {c.ours}
          </h2>
          <p className="text-fg-2">{c.oursBody}</p>
        </section>

        <section className="space-y-4" aria-labelledby="not-h">
          <h2 id="not-h" className="text-2xl font-light">
            {c.notices}
          </h2>
          <p className="text-fg-2">{c.noticesBody}</p>
          {NOTICES.map((n) => (
            <details key={n.id} id={n.id} className="rounded-xl border border-line p-4">
              <summary className="min-h-11 cursor-pointer py-2 font-medium" dir="ltr" lang="en">
                {n.title}
              </summary>
              <pre dir="ltr" lang="en" className="mt-3 max-h-96 overflow-auto font-word text-xs leading-relaxed whitespace-pre-wrap text-fg-2">
                {n.text}
              </pre>
            </details>
          ))}
        </section>

        <p className="text-sm text-fg-2">
          <Link href="/privacy" className="underline underline-offset-4">
            {t.nav.privacy}
          </Link>
        </p>
      </div>
    </Page>
  );
}
