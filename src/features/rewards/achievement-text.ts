/** Bilingual titles and descriptions for each achievement id. */
export const ACHIEVEMENT_TEXT: Readonly<Record<string, { ar: { title: string; body: string }; en: { title: string; body: string } }>> = {
  "first-test": {
    ar: { title: "السطر الأول", body: "أكملت أول اختبار كتابة." },
    en: { title: "First line", body: "You finished your first typing test." },
  },
  diagnostic: {
    ar: { title: "نقطة البداية", body: "أكملت الاختبار التشخيصي." },
    en: { title: "Starting point", body: "You completed the diagnostic." },
  },
  "wpm-20": { ar: { title: "20 كلمة في الدقيقة", body: "وصلت إلى 20 كلمة في الدقيقة بدقة جيدة." }, en: { title: "20 wpm", body: "You reached 20 words per minute with good accuracy." } },
  "wpm-40": { ar: { title: "40 كلمة في الدقيقة", body: "وصلت إلى 40 كلمة في الدقيقة." }, en: { title: "40 wpm", body: "You reached 40 words per minute." } },
  "wpm-60": { ar: { title: "60 كلمة في الدقيقة", body: "سرعة كتابة مهنية." }, en: { title: "60 wpm", body: "A professional typing speed." } },
  "accuracy-98": {
    ar: { title: "يد ثابتة", body: "دقة 98٪ أو أكثر في اختبار مدته دقيقة." },
    en: { title: "Steady hand", body: "98% accuracy or more in a one-minute test." },
  },
  "streak-3": { ar: { title: "ثلاثة أيام", body: "تمرّنت ثلاثة أيام متتالية." }, en: { title: "Three days", body: "You practised three days in a row." } },
  "streak-7": { ar: { title: "أسبوع كامل", body: "تمرّنت سبعة أيام متتالية." }, en: { title: "A full week", body: "You practised seven days in a row." } },
  "streak-30": { ar: { title: "شهر من الكتابة", body: "تمرّنت ثلاثين يومًا متتالية." }, en: { title: "A month of writing", body: "You practised thirty days in a row." } },
  "spelling-50": { ar: { title: "خمسون كلمة", body: "كتبت 50 كلمة إملاء صحيحة." }, en: { title: "Fifty words", body: "You spelled 50 dictation words correctly." } },
  "sentences-25": { ar: { title: "خمس وعشرون جملة", body: "كتبت 25 جملة صحيحة تمامًا." }, en: { title: "Twenty-five sentences", body: "You wrote 25 fully correct sentences." } },
  "scenario-first": {
    ar: { title: "أول رسالة مهنية", body: "اجتازت رسالتك قائمة التحقق كاملة." },
    en: { title: "First professional message", body: "One of your messages passed the full checklist." },
  },
  "scenario-all": {
    ar: { title: "جاهز للعمل", body: "اجتزت كل مواقف الكتابة المهنية." },
    en: { title: "Work-ready", body: "You passed every professional writing scenario." },
  },
  "lessons-all": { ar: { title: "الأصابع في مكانها", body: "أكملت كل دروس الأساس." }, en: { title: "Fingers in place", body: "You completed every foundation lesson." } },
  "level-5": { ar: { title: "المستوى الخامس", body: "وصلت إلى مستوى التمرين الخامس." }, en: { title: "Level five", body: "You reached practice level five." } },
};
