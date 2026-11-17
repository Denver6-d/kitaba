import type { Lesson } from "./schema";

/**
 * Foundation lessons for finger placement, written for learners whose hands
 * know the Arabic layout. Drills use real words and phrases, not random letters.
 */
export const lessons: readonly Lesson[] = [
  {
    id: "home-row",
    order: 1,
    keys: "asdfghjkl;",
    titleAr: "صف الارتكاز",
    titleEn: "The home row",
    noteAr:
      "ضع سبابتيك على F و J (عليهما نتوءات صغيرة). هذه هي المفاتيح نفسها التي تحمل «ب» و«ت» في التخطيط العربي، فمكان يديك لا يتغير، بل الحروف فقط.",
    noteEn:
      "Rest your index fingers on F and J (they have small bumps). These are the same keys as the Arabic letters ba and ta, so your hands stay where they are; only the letters change.",
    drills: ["a sad lad", "a glass flask", "dad has a salad", "all fall", "ask dad", "a lad asks"],
  },
  {
    id: "top-row",
    order: 2,
    keys: "qwertyuiop",
    titleAr: "الصف العلوي",
    titleEn: "The top row",
    noteAr:
      "مدّ إصبعك إلى الأعلى ثم ارجع إلى صف الارتكاز. الحرف E بالإصبع الوسطى اليسرى (مكان «ث»)، والحرف I بالوسطى اليمنى (مكان «ه»).",
    noteEn:
      "Reach up, then return to the home row. E is the left middle finger (where tha is), and I is the right middle finger (where ha is).",
    drills: ["we type quite well", "write your story", "the tree is tall", "your path is right", "try it out", "quiet water"],
  },
  {
    id: "bottom-row",
    order: 3,
    keys: "zxcvbnm,./",
    titleAr: "الصف السفلي",
    titleEn: "The bottom row",
    noteAr:
      "الحرف B بالسبابة اليسرى. في التخطيط العربي هذا المفتاح هو «لا»، فلا تخلط بينهما. الفاصلة والنقطة في الإنجليزية مكان «و» و«ز».",
    noteEn:
      "B is your left index finger. On the Arabic layout this key is lam-alif, so do not mix them up. The English comma and full stop sit where waw and zay are.",
    drills: ["a big brown box", "come back soon.", "zero, one, more.", "my van is black", "visit me, ben.", "move now, mona."],
  },
  {
    id: "capitals",
    order: 4,
    keys: "Shift",
    titleAr: "الحروف الكبيرة",
    titleEn: "Capital letters",
    noteAr:
      "العربية لا تعرف الحروف الكبيرة، لكن الإنجليزية تبدأ بها كل جملة وكل اسم علم وكلمة I. اضغط Shift باليد المقابلة للحرف.",
    noteEn:
      "Arabic has no capital letters, but English uses them to start every sentence, every name and the word I. Press Shift with the hand opposite the letter.",
    drills: ["I live in Amman.", "Sara and Omar are here.", "My name is Laila.", "We met in Dubai.", "I love Fridays.", "Ahmed works in Riyadh."],
  },
  {
    id: "punctuation",
    order: 5,
    keys: ".,?!'",
    titleAr: "علامات الترقيم",
    titleEn: "Punctuation",
    noteAr:
      "علامة الاستفهام الإنجليزية ? تتجه عكس العربية ؟، والفاصلة , تتجه عكس الفاصلة العربية ،. اكتب العلامة ملاصقة للكلمة ثم مسافة.",
    noteEn:
      "The English question mark ? faces the other way from the Arabic one, and so does the comma. Put the mark right after the word, then a space.",
    drills: ["How are you?", "Yes, I am fine.", "It's my friend's car.", "Wait! Don't go.", "Is this yours?", "Well, I think so."],
  },
  {
    id: "numbers",
    order: 6,
    keys: "1234567890",
    titleAr: "الأرقام",
    titleEn: "Numbers",
    noteAr:
      "الإنجليزية تستخدم الأرقام 1 2 3 وليس ١ ٢ ٣. والأرقام تُكتب من اليسار إلى اليمين كما في العربية تمامًا.",
    noteEn:
      "English uses the digits 1 2 3, not the Eastern Arabic digits. Numbers are written left to right, exactly as in Arabic.",
    drills: ["I have 2 cats.", "Call me at 5.", "Room 104 is open.", "It costs 30 dollars.", "We met in 2019.", "Page 7, line 12."],
  },
];
