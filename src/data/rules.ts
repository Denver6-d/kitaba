import type { SpellingCategory } from "./schema";

interface Bilingual {
  readonly ar: string;
  readonly en: string;
}

export interface CategoryInfo {
  readonly label: Bilingual;
  /** One-line rule shown after a mistake. Original wording, written for this project. */
  readonly rule: Bilingual;
  /** A short memory trick for the mint rule card (DESIGN.md V3, correction). Original wording. */
  readonly trick: Bilingual;
  /**
   * The example words the trick names (written as in the trick, in both languages). When the
   * missed word is not one of them, the trick is shown as an example (`trickFor`). Empty when
   * the trick names no word to spell.
   */
  readonly trickWords: readonly string[];
}

export const CATEGORY_INFO: Readonly<Record<SpellingCategory, CategoryInfo>> = {
  common: {
    label: { ar: "كلمات يكثر الخطأ فيها", en: "Commonly misspelled" },
    rule: {
      ar: "هذه الكلمة لا تُكتب كما تُنطق تمامًا. احفظ شكلها بتقسيمها إلى مقاطع صغيرة.",
      en: "This word is not spelled the way it sounds. Learn it in small chunks.",
    },
    trick: {
      ar: "قسّم الكلمة وانطقها في ذهنك كما تُكتب: Wed-nes-day.",
      en: "Say it in your head the way it is written: Wed-nes-day.",
    },
    trickWords: ["wednesday"],
  },
  homophones: {
    label: { ar: "كلمات متشابهة النطق", en: "Homophones and confusables" },
    rule: {
      ar: "كلمات تتشابه في النطق وتختلف في المعنى والكتابة. المعنى في الجملة هو الذي يحدد الكتابة.",
      en: "These words sound alike but differ in meaning and spelling. The sentence decides which one you need.",
    },
    trick: {
      ar: "في there كلمة here: كلتاهما عن المكان.",
      en: "there has here inside it: both are about places.",
    },
    trickWords: ["there", "here"],
  },
  "double-letters": {
    label: { ar: "الحروف المضاعفة", en: "Double letters" },
    rule: {
      ar: "انتبه للحرف المضاعف: لا تسمعه مرتين، لكنه يُكتب مرتين.",
      en: "Watch the double letter: you hear it once, but you write it twice.",
    },
    trick: {
      ar: "في necessary قميص له ياقة واحدة (c) وكُمّان (ss).",
      en: "necessary is a shirt with one collar (c) and two sleeves (ss).",
    },
    trickWords: ["necessary"],
  },
  "silent-letters": {
    label: { ar: "الحروف الصامتة", en: "Silent letters" },
    rule: {
      ar: "في هذه الكلمة حرف يُكتب ولا يُنطق. تذكّره عند الكتابة.",
      en: "This word has a letter you write but do not say. Remember to include it.",
    },
    trick: {
      ar: "انطق الحرف الصامت في ذهنك وأنت تكتب: k-nife و w-rite.",
      en: "Say the silent letter in your head as you write: k-nife, w-rite.",
    },
    trickWords: ["knife", "write"],
  },
  "ie-ei": {
    label: { ar: "الترتيب ie أم ei", en: "ie or ei" },
    rule: {
      ar: "القاعدة الغالبة: i قبل e، إلا بعد c (receive)، أو إذا نُطقت مثل «إيْ» (eight). ولها استثناءات تُحفظ.",
      en: "Usually i before e, except after c (receive) or when it sounds like 'ay' (eight). Some exceptions must be learned.",
    },
    trick: {
      ar: "كلمة friend تنتهي بـ end: الصديق يبقى معك حتى النهاية.",
      en: "friend ends in end: a friend stays with you to the end.",
    },
    trickWords: ["friend"],
  },
  plurals: {
    label: { ar: "الجمع", en: "Plurals" },
    rule: {
      ar: "نضيف s عادةً، و es بعد s و x و z و ch و sh وبعد o في كلمات مثل potatoes. الساكن ثم y يصبح ies، و f أو fe تصبح ves غالبًا. وبعض الكلمات جمعها شاذ.",
      en: "Add s; add es after s, x, z, ch, sh (and o in words like potatoes); consonant + y becomes ies; f or fe often becomes ves. Some plurals are irregular.",
    },
    trick: {
      ar: "y بعد حرف ساكن تصبح ies (babies)، وبعد حرف متحرك تبقى (boys).",
      en: "y after a consonant becomes ies (babies); after a vowel it stays (boys).",
    },
    trickWords: ["babies", "boys"],
  },
  "verb-endings": {
    label: { ar: "نهايات الأفعال ed و ing", en: "-ed and -ing endings" },
    rule: {
      ar: "احذف حرف e الأخير قبل ing (make → making). ضاعف الحرف الساكن الأخير في الكلمة ذات المقطع الواحد التي تنتهي بساكن ثم متحرك ثم ساكن (stop → stopping، لكن read → reading)، وفي الكلمة الأطول إذا كان النبر على مقطعها الأخير (begin → beginning، occur → occurred). الساكن ثم y يصبح ied قبل ed فقط (study → studied)، ويبقى y قبل ing (studying).",
      en: "Drop a final e before -ing (make → making). Double the last consonant of a one-syllable word that ends consonant-vowel-consonant (stop → stopping, but read → reading), and of a longer word whose stressed last syllable ends that way (begin → beginning, occur → occurred). Consonant + y becomes ied only before -ed (study → studied); y stays before -ing (studying).",
    },
    trick: {
      ar: "حرف e الأخير يُفسح المكان لـ ing: make تصبح making.",
      en: "A final e makes room for -ing: make becomes making.",
    },
    trickWords: ["make", "making"],
  },
  "adverbs-ly": {
    label: { ar: "الظروف المنتهية بـ ly", en: "-ly adverbs" },
    rule: {
      ar: "نضيف ly إلى الصفة كما هي (careful → carefully)، و y تصبح ily، و le تصبح ly، و ic تصبح ically.",
      en: "Add ly to the whole adjective (careful → carefully); y becomes ily; le becomes ly; ic becomes ically.",
    },
    trick: {
      ar: "الصفة تبقى كاملة ثم تأتي ly: careful و ly تعطي carefully، ومن هنا ll.",
      en: "Keep the whole adjective, then add ly: careful + ly = carefully, hence ll.",
    },
    trickWords: ["careful", "carefully"],
  },
  prefixes: {
    label: { ar: "البادئات", en: "Prefixes" },
    rule: {
      ar: "البادئة تُضاف كما هي دون تغيير الكلمة، لذلك قد يتكرر الحرف: dis + satisfied = dissatisfied.",
      en: "A prefix is added without changing the word, so letters can double: dis + satisfied = dissatisfied.",
    },
    trick: {
      ar: "افصل البادئة عن الكلمة: mis و spell تعطي misspell.",
      en: "Split the prefix off: mis + spell = misspell.",
    },
    trickWords: ["misspell"],
  },
  suffixes: {
    label: { ar: "اللواحق", en: "Suffixes" },
    rule: {
      ar: "انتبه لنهاية الكلمة: able أم ible، و ance أم ence، و ment، و tion. كثير منها يُحفظ بالشكل.",
      en: "Watch the ending: -able or -ible, -ance or -ence, -ment, -tion. Many must be learned by sight.",
    },
    trick: {
      ar: "إذا بقيت قبل النهاية كلمة كاملة فالنهاية غالبًا able: accept و able تعطي acceptable.",
      en: "If a whole word is left before the ending, it is usually -able: acceptable.",
    },
    trickWords: ["acceptable"],
  },
  "british-american": {
    label: { ar: "البريطانية والأمريكية", en: "British and American" },
    rule: {
      ar: "الأمريكية: color و center و organize. البريطانية: colour و centre و organise. اختر نوعًا واحدًا والتزم به.",
      en: "American: color, center, organize. British: colour, centre, organise. Pick one and stay consistent.",
    },
    trick: {
      ar: "الأمريكية أقصر غالبًا: color أقصر من colour.",
      en: "American is usually shorter: color is shorter than colour.",
    },
    trickWords: ["color", "colour"],
  },
  "p-b": {
    label: { ar: "الحرفان P و B", en: "P and B" },
    rule: {
      ar: "العربية ليس فيها صوت P. صوت P يخرج معه نفَس هواء، و B لا. ضع يدك أمام فمك لتشعر بالفرق.",
      en: "Arabic has no P sound. P comes with a puff of air; B does not. Feel it with your hand in front of your mouth.",
    },
    trick: {
      ar: "أمسك ورقة أمام فمك: تتحرك مع p وتبقى ساكنة مع b.",
      en: "Hold a sheet of paper in front of your mouth: it moves for p, not for b.",
    },
    trickWords: [],
  },
  "v-f": {
    label: { ar: "الحرفان V و F", en: "V and F" },
    rule: {
      ar: "صوت V مجهور تهتز معه الحنجرة، وصوت F مهموس بلا اهتزاز. المس حلقك وأنت تنطق لتميّز بينهما.",
      en: "V is voiced (your throat vibrates); F is not. Touch your throat as you say it to tell them apart.",
    },
    trick: {
      ar: "fan همس بلا صوت، و van طنين تشعر به في حلقك.",
      en: "fan is a whisper, van is a buzz you can feel in your throat.",
    },
    trickWords: ["fan", "van"],
  },
  "short-vowels": {
    label: { ar: "الحروف المتحركة القصيرة", en: "Short vowels" },
    rule: {
      ar: "في العربية لا تُكتب الحركات القصيرة، أما في الإنجليزية فكل حركة تُكتب حرفًا. لا تحذف الحروف المتحركة.",
      en: "Arabic leaves short vowels unwritten; English writes every vowel as a letter. Don't drop them.",
    },
    trick: {
      ar: "لكل مقطع حرف متحرك واحد على الأقل: cat و pen و sit.",
      en: "Every syllable has at least one vowel letter: cat, pen, sit.",
    },
    trickWords: ["cat", "pen", "sit"],
  },
  "vowel-confusion": {
    label: { ar: "خلط e و i و a", en: "e, i and a confusion" },
    rule: {
      ar: "الحروف المتحركة الضعيفة تُنطق متشابهة، فلا تعتمد على السمع. استعن بحيلة للتذكّر: في separate كلمة a part.",
      en: "Weak vowels sound alike, so don't spell by ear. Use a memory trick: separate has 'a part' in it.",
    },
    trick: {
      ar: "في separate تجد a part، وفي definite تجد finite.",
      en: "separate has a part in it; definite has finite in it.",
    },
    trickWords: ["separate", "definite"],
  },
};

/** "مثال:" / "Example:" before a trick whose example word is not the word that was missed. */
export const TRICK_EXAMPLE_PREFIX: Bilingual = { ar: "مثال:", en: "Example:" };

/**
 * The memory trick to show after a miss. Tricks are written per category around one example
 * word; when the missed word is not that example, the trick is marked as an example, so the
 * learner does not read it as being about their own word.
 */
export function trickFor(info: CategoryInfo, missedWord: string, lang: keyof Bilingual): string {
  const w = missedWord.trim().toLowerCase();
  const own = info.trickWords.length === 0 || info.trickWords.some((t) => t.toLowerCase() === w);
  return own ? info.trick[lang] : `${TRICK_EXAMPLE_PREFIX[lang]} ${info.trick[lang]}`;
}
