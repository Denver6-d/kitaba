import type { SpellingCategory } from "./schema";

interface Bilingual {
  readonly ar: string;
  readonly en: string;
}

export interface CategoryInfo {
  readonly label: Bilingual;
  /** One-line rule shown after a mistake. Original wording, written for this project. */
  readonly rule: Bilingual;
}

export const CATEGORY_INFO: Readonly<Record<SpellingCategory, CategoryInfo>> = {
  common: {
    label: { ar: "كلمات يكثر الخطأ فيها", en: "Commonly misspelled" },
    rule: {
      ar: "هذه الكلمة لا تُكتب كما تُنطق تمامًا. احفظ شكلها بتقسيمها إلى مقاطع صغيرة.",
      en: "This word is not spelled the way it sounds. Learn it in small chunks.",
    },
  },
  homophones: {
    label: { ar: "كلمات متشابهة النطق", en: "Homophones and confusables" },
    rule: {
      ar: "كلمات تتشابه في النطق وتختلف في المعنى والكتابة. المعنى في الجملة هو الذي يحدد الكتابة.",
      en: "These words sound alike but differ in meaning and spelling. The sentence decides which one you need.",
    },
  },
  "double-letters": {
    label: { ar: "الحروف المضاعفة", en: "Double letters" },
    rule: {
      ar: "انتبه للحرف المضاعف: لا تسمعه مرتين، لكنه يُكتب مرتين.",
      en: "Watch the double letter: you hear it once, but you write it twice.",
    },
  },
  "silent-letters": {
    label: { ar: "الحروف الصامتة", en: "Silent letters" },
    rule: {
      ar: "في هذه الكلمة حرف يُكتب ولا يُنطق. تذكّره عند الكتابة.",
      en: "This word has a letter you write but do not say. Remember to include it.",
    },
  },
  "ie-ei": {
    label: { ar: "الترتيب ie أم ei", en: "ie or ei" },
    rule: {
      ar: "القاعدة الغالبة: i قبل e، إلا بعد c (receive)، أو إذا نُطقت مثل «إيْ» (eight). ولها استثناءات تُحفظ.",
      en: "Usually i before e, except after c (receive) or when it sounds like 'ay' (eight). Some exceptions must be learned.",
    },
  },
  plurals: {
    label: { ar: "الجمع", en: "Plurals" },
    rule: {
      ar: "نضيف s عادةً، وes بعد s وx وz وch وsh وبعد o في كلمات مثل potatoes. الساكن ثم y يصبح ies، وf أو fe تصبح ves غالبًا. وبعض الكلمات جمعها شاذ.",
      en: "Add s; add es after s, x, z, ch, sh (and o in words like potatoes); consonant + y becomes ies; f or fe often becomes ves. Some plurals are irregular.",
    },
  },
  "verb-endings": {
    label: { ar: "نهايات الأفعال ed وing", en: "-ed and -ing endings" },
    rule: {
      ar: "احذف حرف e الأخير قبل ing، وضاعف الحرف الساكن الأخير في الكلمات القصيرة (stop → stopping)، والساكن ثم y يصبح ied.",
      en: "Drop a final e before -ing, double the last consonant in short words (stop → stopping), and consonant + y becomes ied.",
    },
  },
  "adverbs-ly": {
    label: { ar: "الظروف المنتهية بـ ly", en: "-ly adverbs" },
    rule: {
      ar: "نضيف ly إلى الصفة كما هي (careful → carefully)، وy تصبح ily، وle تصبح ly، وic تصبح ically.",
      en: "Add ly to the whole adjective (careful → carefully); y becomes ily; le becomes ly; ic becomes ically.",
    },
  },
  prefixes: {
    label: { ar: "البادئات", en: "Prefixes" },
    rule: {
      ar: "البادئة تُضاف كما هي دون تغيير الكلمة، لذلك قد يتكرر الحرف: dis + satisfied = dissatisfied.",
      en: "A prefix is added without changing the word, so letters can double: dis + satisfied = dissatisfied.",
    },
  },
  suffixes: {
    label: { ar: "اللواحق", en: "Suffixes" },
    rule: {
      ar: "انتبه لنهاية الكلمة: able أم ible، وance أم ence، وment، وtion. كثير منها يُحفظ بالشكل.",
      en: "Watch the ending: -able or -ible, -ance or -ence, -ment, -tion. Many must be learned by sight.",
    },
  },
  "british-american": {
    label: { ar: "البريطانية والأمريكية", en: "British and American" },
    rule: {
      ar: "الأمريكية: color وcenter وorganize. البريطانية: colour وcentre وorganise. اختر نوعًا واحدًا والتزم به.",
      en: "American: color, center, organize. British: colour, centre, organise. Pick one and stay consistent.",
    },
  },
  "p-b": {
    label: { ar: "الحرفان P وB", en: "P and B" },
    rule: {
      ar: "العربية ليس فيها صوت P. صوت P يخرج معه نفَس هواء، وB لا. ضع يدك أمام فمك لتشعر بالفرق.",
      en: "Arabic has no P sound. P comes with a puff of air; B does not. Feel it with your hand in front of your mouth.",
    },
  },
  "v-f": {
    label: { ar: "الحرفان V وF", en: "V and F" },
    rule: {
      ar: "صوت V مجهور تهتز معه الحنجرة، وصوت F مهموس بلا اهتزاز. المس حلقك وأنت تنطق لتميّز بينهما.",
      en: "V is voiced (your throat vibrates); F is not. Touch your throat as you say it to tell them apart.",
    },
  },
  "short-vowels": {
    label: { ar: "الحروف المتحركة القصيرة", en: "Short vowels" },
    rule: {
      ar: "في العربية لا تُكتب الحركات القصيرة، أما في الإنجليزية فكل حركة تُكتب حرفًا. لا تحذف الحروف المتحركة.",
      en: "Arabic leaves short vowels unwritten; English writes every vowel as a letter. Don't drop them.",
    },
  },
  "vowel-confusion": {
    label: { ar: "خلط e وi وa", en: "e, i and a confusion" },
    rule: {
      ar: "الحروف المتحركة الضعيفة تُنطق متشابهة، فلا تعتمد على السمع. استعن بحيلة للتذكّر: في separate كلمة a part.",
      en: "Weak vowels sound alike, so don't spell by ear. Use a memory trick: separate has 'a part' in it.",
    },
  },
};
