import type { WordRow } from "./row";

/**
 * Homophones and confusables: words that sound alike (or nearly) but are
 * spelled differently. They are always spoken with their example sentence, and
 * their confusables are the distractors in Pick the Right Spelling.
 */
export const homophones: readonly WordRow[] = [
  ["their", "لهم (ملكية)", "A2", "Their house is big.", { confusables: ["there", "they're"] }],
  ["there", "هناك", "A1", "There is a cat in the garden.", { confusables: ["their", "they're"] }],
  ["they're", "اختصار: هم يكونون", "A2", "They're late again.", { confusables: ["their", "there"] }],
  ["your", "لك (ملكية)", "A1", "Is this your bag?", { confusables: ["you're"] }],
  ["you're", "اختصار: أنت تكون", "A2", "You're welcome.", { confusables: ["your"] }],
  ["its", "له/لها (ملكية لغير العاقل)", "B1", "The company changed its name.", { confusables: ["it's"] }],
  ["it's", "اختصار: هو يكون (لغير العاقل)", "A2", "It's very hot today.", { confusables: ["its"] }],
  ["too", "أيضًا / جدًا", "A1", "I want to come too.", { confusables: ["two", "to"] }],
  ["two", "اثنان", "A1", "I have two sisters.", { confusables: ["too", "to"] }],
  ["then", "ثم", "A2", "Wash your hands, then eat.", { confusables: ["than"] }],
  ["than", "من (للمقارنة)", "A2", "She is taller than me.", { confusables: ["then"] }],
  ["where", "أين", "A1", "Where do you live?", { confusables: ["wear", "were"] }],
  ["wear", "يرتدي", "A1", "I wear a jacket in winter.", { confusables: ["where", "ware"] }],
  ["here", "هنا", "A1", "Come here, please.", { confusables: ["hear"] }],
  ["hear", "يسمع", "A1", "Can you hear me?", { confusables: ["here"] }],
  ["right", "صحيح / يمين", "A1", "Turn right at the bank.", { confusables: ["write", "rite"] }],
  ["buy", "يشتري", "A1", "I want to buy a new phone.", { confusables: ["by", "bye"] }],
  ["knew", "عرف (ماضٍ)", "A2", "I knew the answer.", { confusables: ["new"] }],
  ["new", "جديد", "A1", "I have a new car.", { confusables: ["knew"] }],
  ["weather", "الطقس", "A1", "The weather is nice today.", { confusables: ["whether"] }],
  ["whether", "ما إذا", "B1", "I don't know whether he will come.", { confusables: ["weather"] }],
  ["piece", "قطعة", "A2", "Can I have a piece of cake?", { confusables: ["peace"] }],
  ["peace", "سلام", "A2", "We all want peace.", { confusables: ["piece"] }],
  ["week", "أسبوع", "A1", "I work five days a week.", { confusables: ["weak"] }],
  ["weak", "ضعيف", "A2", "I feel weak today.", { confusables: ["week"] }],
  ["meet", "يقابل", "A1", "Nice to meet you.", { confusables: ["meat"] }],
  ["meat", "لحم", "A1", "I don't eat meat.", { confusables: ["meet"] }],
  ["sea", "بحر", "A1", "We swim in the sea.", { confusables: ["see"] }],
  ["see", "يرى", "A1", "I can see the moon.", { confusables: ["sea"] }],
  ["whole", "كامل", "A2", "I read the whole book.", { confusables: ["hole"] }],
  ["allowed", "مسموح", "B1", "Phones are not allowed here.", { confusables: ["aloud"] }],
  ["plain", "بسيط / سادة", "B1", "I prefer plain yogurt.", { confusables: ["plane"] }],
];
