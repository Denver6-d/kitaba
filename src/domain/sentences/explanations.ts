import type { ErrorType, GradedError, StyleNote } from "./grader";

/** Bilingual explanations for each error class, written for Arabic speakers. */
export interface Explanation {
  readonly ar: string;
  readonly en: string;
}

const q = (w: string | undefined) => (w ? `"${w}"` : "");

export const ERROR_NAMES: Readonly<Record<ErrorType, Explanation>> = {
  "missing-article": { ar: "أداة ناقصة", en: "Missing article" },
  "extra-article": { ar: "أداة زائدة", en: "Extra article" },
  "wrong-article": { ar: "أداة غير مناسبة", en: "Wrong article" },
  "missing-be": { ar: "فعل الكينونة ناقص", en: "Missing \"to be\"" },
  "extra-be": { ar: "فعل كينونة زائد", en: "Extra \"to be\"" },
  preposition: { ar: "حرف جر", en: "Preposition" },
  "verb-form": { ar: "زمن الفعل أو صيغته", en: "Verb tense or form" },
  plural: { ar: "المفرد والجمع", en: "Singular or plural" },
  "word-order": { ar: "ترتيب الكلمات", en: "Word order" },
  spelling: { ar: "إملاء", en: "Spelling" },
  "missing-word": { ar: "كلمة ناقصة", en: "Missing word" },
  "extra-word": { ar: "كلمة زائدة", en: "Extra word" },
  "wrong-word": { ar: "كلمة مختلفة", en: "Different word" },
};

export function explain(e: GradedError): Explanation {
  const ex = q(e.expected);
  const ac = q(e.actual);
  switch (e.type) {
    case "missing-article":
      return {
        ar: `أضف ${ex}. الإنجليزية تحتاج أداة قبل الاسم المفرد المعدود (a/an) أو المعروف (the)، حتى حين لا تحتاج العربية إلى «ال».`,
        en: `Add ${ex}. English needs an article before a singular countable noun (a/an) or a known one (the).`,
      };
    case "extra-article":
      return {
        ar: `احذف ${ac}. أسماء المدن والأشخاص والأشياء العامة (I like coffee) لا تأخذ the في الإنجليزية، مع أن العربية تقول «القهوة».`,
        en: `Remove ${ac}. Names of cities and people, and general things (I like coffee), take no "the" in English.`,
      };
    case "wrong-article":
      return {
        ar: `استخدم ${ex} بدل ${ac}. نكتب an قبل صوت متحرك (an apple) وa قبل صوت ساكن (a car).`,
        en: `Use ${ex} instead of ${ac}. Write "an" before a vowel sound (an apple) and "a" before a consonant sound (a car).`,
      };
    case "missing-be":
      return {
        ar: `أضف ${ex}. في العربية نقول «هي سعيدة» دون فعل، لكن الإنجليزية تحتاج am / is / are: She is happy.`,
        en: `Add ${ex}. Arabic says "she happy" with no verb, but English needs am / is / are: She is happy.`,
      };
    case "extra-be":
      return {
        ar: `احذف ${ac}. لا نضع am / is / are مع فعل عادي في المضارع البسيط: I agree وليس I am agree.`,
        en: `Remove ${ac}. Do not put am / is / are before an ordinary verb in the present simple: "I agree", not "I am agree".`,
      };
    case "preposition":
      return e.expected && e.actual
        ? {
            ar: `استخدم ${ex} بدل ${ac}. حروف الجر لا تُترجم حرفيًا من العربية؛ احفظها مع الفعل أو الاسم (at home، on the table، good at).`,
            en: `Use ${ex} instead of ${ac}. Prepositions do not translate word for word from Arabic; learn them with the verb or noun (at home, on the table, good at).`,
          }
        : e.expected
          ? {
              ar: `أضف حرف الجر ${ex}. بعض الأفعال تحتاج حرف جر قبل المكان، مثل go to school.`,
              en: `Add the preposition ${ex}. Some verbs need a preposition before a place, like "go to school".`,
            }
          : {
              ar: `احذف ${ac}. بعض الأفعال لا تأخذ حرف جر في الإنجليزية، مثل visit London وdiscuss the plan.`,
              en: `Remove ${ac}. Some verbs take no preposition in English, like "visit London" and "discuss the plan".`,
            };
    case "verb-form":
      return {
        ar: `اكتب ${ex} بدل ${ac}. انتبه للزمن (yesterday ← الماضي) وللـ s مع he / she / it في المضارع، وللصيغة بعد did / can / to (الفعل المجرد).`,
        en: `Write ${ex} instead of ${ac}. Check the tense (yesterday → past), the -s with he / she / it in the present, and the base form after did / can / to.`,
      };
    case "plural":
      return {
        ar: `اكتب ${ex} بدل ${ac}. بعد الأعداد وكلمات مثل many / some / these يأتي الاسم جمعًا؛ وبعض الجموع شاذة (children، people).`,
        en: `Write ${ex} instead of ${ac}. After numbers and words like many / some / these the noun is plural; some plurals are irregular (children, people).`,
      };
    case "word-order":
      return {
        ar: `الكلمة ${ex} في غير مكانها. في الإنجليزية: الصفة قبل الاسم (a red car)، والظرف مثل always بعد am / is / are، والسؤال يبدأ بالفعل المساعد (Where is…?).`,
        en: `${ex} is in the wrong place. In English the adjective comes before the noun (a red car), adverbs like "always" go after am / is / are, and questions put the helper verb first (Where is…?).`,
      };
    case "spelling":
      return {
        ar: `الإملاء الصحيح: ${ex}. لاحظ الحروف المتحركة والحروف المضاعفة.`,
        en: `The correct spelling is ${ex}. Check the vowels and any double letters.`,
      };
    case "missing-word":
      return {
        ar: `كلمة ناقصة: ${ex}.${e.expected === "to" ? " بعد أفعال مثل want / need / like نضع to قبل الفعل الثاني." : ""}`,
        en: `Missing word: ${ex}.${e.expected === "to" ? ' After verbs like want / need / like, put "to" before the second verb.' : ""}`,
      };
    case "extra-word":
      return { ar: `احذف ${ac}.`, en: `Remove ${ac}.` };
    case "wrong-word":
      return {
        ar: `توقّعنا ${ex} بدل ${ac}. قد يكون معنى كلمتك صحيحًا، لكنها لا تطابق الإجابات المقبولة لدينا.`,
        en: `We expected ${ex} instead of ${ac}. Your word may be fine, but it does not match the answers we know.`,
      };
  }
}

export const NOTE_TEXT: Readonly<Record<StyleNote, Explanation>> = {
  "start-capital": { ar: "ابدأ الجملة بحرف كبير.", en: "Start the sentence with a capital letter." },
  "end-punctuation": { ar: "أنهِ الجملة بنقطة أو علامة استفهام.", en: "End the sentence with a full stop or question mark." },
  "lowercase-i": { ar: "الضمير I يُكتب دائمًا كبيرًا.", en: "The pronoun I is always a capital letter." },
  "missing-apostrophe": { ar: "الاختصار يحتاج فاصلة عليا: don't وI'm.", en: "Contractions need an apostrophe: don't, I'm." },
};
