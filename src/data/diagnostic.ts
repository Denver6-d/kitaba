import type { Sentence, SpellingWord } from "./schema";

/** Fixed diagnostic items so every learner is placed with the same yardstick. */
export const diagnosticWords: readonly SpellingWord[] = [
  { id: "diag-because", word: "because", ar: "لأنّ", level: "A1", category: "vowel-confusion", example: "I stayed home because it rained." },
  { id: "diag-friend", word: "friend", ar: "صديق", level: "A1", category: "ie-ei", example: "She is my best friend." },
  { id: "diag-people", word: "people", ar: "ناس", level: "A1", category: "vowel-confusion", example: "Many people live here." },
  { id: "diag-beautiful", word: "beautiful", ar: "جميل", level: "A1", category: "vowel-confusion", example: "What a beautiful day." },
  { id: "diag-different", word: "different", ar: "مختلف", level: "A2", category: "double-letters", example: "We have different ideas." },
  { id: "diag-problem", word: "problem", ar: "مشكلة", level: "A1", category: "p-b", example: "There is a problem with my phone." },
  { id: "diag-very", word: "very", ar: "جدًا", level: "A1", category: "v-f", example: "It is very cold." },
  { id: "diag-know", word: "know", ar: "يعرف", level: "A1", category: "silent-letters", example: "I know the answer." },
  { id: "diag-address", word: "address", ar: "عنوان", level: "A2", category: "double-letters", example: "Write your address here." },
  { id: "diag-receive", word: "receive", ar: "يستلم", level: "B1", category: "ie-ei", example: "Did you receive my email?" },
];

export const diagnosticSentences: readonly Sentence[] = [
  { id: "diag-s1", ar: "أختي طالبة في الجامعة.", en: ["My sister is a student at the university.", "My sister is a university student.", "My sister is a student at university."], level: "A1", topic: "family" },
  { id: "diag-s2", ar: "ذهبنا إلى السوق أمس.", en: ["We went to the market yesterday.", "Yesterday we went to the market.", "We went to the souq yesterday."], level: "A2", topic: "daily-life" },
  { id: "diag-s3", ar: "أود أن أحجز موعدًا يوم الثلاثاء.", en: ["I would like to book an appointment on Tuesday.", "I would like to make an appointment on Tuesday.", "I'd like to book an appointment for Tuesday.", "I would like to book an appointment for Tuesday."], level: "B1", topic: "work" },
];
