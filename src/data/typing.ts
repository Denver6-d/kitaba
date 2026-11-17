import type { Level, TypingItem } from "./schema";

/**
 * Typing practice content. Phrases and full sentences come first; isolated
 * words are only used for the "words" test mode and adaptive drills.
 */

type Row = readonly [text: string, ar: string, level: Level];

const PHRASES: readonly Row[] = [
  ["good morning", "صباح الخير", "A1"],
  ["thank you very much", "شكرًا جزيلًا", "A1"],
  ["see you tomorrow", "أراك غدًا", "A1"],
  ["how are you today", "كيف حالك اليوم", "A1"],
  ["nice to meet you", "سعيد بلقائك", "A1"],
  ["at the moment", "في الوقت الحالي", "A2"],
  ["in the morning", "في الصباح", "A1"],
  ["on the weekend", "في عطلة نهاية الأسبوع", "A2"],
  ["at home", "في المنزل", "A1"],
  ["a cup of tea", "كوب من الشاي", "A1"],
  ["a lot of work", "الكثير من العمل", "A1"],
  ["next week", "الأسبوع القادم", "A1"],
  ["last year", "العام الماضي", "A1"],
  ["as soon as possible", "في أقرب وقت ممكن", "A2"],
  ["for example", "على سبيل المثال", "A2"],
  ["of course", "بالطبع", "A1"],
  ["no problem", "لا مشكلة", "A1"],
  ["I am sorry", "أنا آسف", "A1"],
  ["excuse me", "عفوًا / المعذرة", "A1"],
  ["please let me know", "من فضلك أخبرني", "A2"],
  ["I look forward to it", "أتطلع إلى ذلك", "B1"],
  ["best regards", "مع أطيب التحيات", "A2"],
  ["kind regards", "مع خالص التحية", "A2"],
  ["thank you for your time", "شكرًا على وقتك", "A2"],
  ["in my opinion", "في رأيي", "A2"],
  ["on time", "في الوقت المحدد", "A1"],
  ["by the way", "بالمناسبة", "A2"],
  ["at the same time", "في الوقت نفسه", "A2"],
  ["once a week", "مرة في الأسبوع", "A1"],
  ["every day", "كل يوم", "A1"],
  ["the day after tomorrow", "بعد غد", "A2"],
  ["in the end", "في النهاية", "A2"],
  ["I would like to", "أود أن", "A2"],
  ["could you please", "هل يمكنك من فضلك", "A2"],
  ["it depends on", "يعتمد على", "B1"],
  ["as far as I know", "على حد علمي", "B1"],
  ["to be honest", "لأكون صريحًا", "B1"],
  ["in addition", "بالإضافة إلى ذلك", "B1"],
  ["on the other hand", "من ناحية أخرى", "B1"],
  ["a few minutes", "بضع دقائق", "A1"],
  ["my phone number", "رقم هاتفي", "A1"],
  ["the meeting room", "غرفة الاجتماعات", "A2"],
  ["a job interview", "مقابلة عمل", "A2"],
  ["customer service", "خدمة العملاء", "A2"],
  ["the attached file", "الملف المرفق", "B1"],
  ["a quick question", "سؤال سريع", "A2"],
  ["happy birthday", "عيد ميلاد سعيد", "A1"],
  ["well done", "أحسنت", "A1"],
  ["take care", "اعتنِ بنفسك", "A1"],
  ["good luck", "حظًا موفقًا", "A1"],
];

const SENTENCES: readonly Row[] = [
  ["I am a student.", "أنا طالب.", "A1"],
  ["My name is Sara.", "اسمي سارة.", "A1"],
  ["I live in Cairo.", "أعيش في القاهرة.", "A1"],
  ["She is my sister.", "هي أختي.", "A1"],
  ["We are at school.", "نحن في المدرسة.", "A1"],
  ["The weather is nice today.", "الطقس جميل اليوم.", "A1"],
  ["I drink coffee every morning.", "أشرب القهوة كل صباح.", "A1"],
  ["He works in a bank.", "يعمل في بنك.", "A1"],
  ["They play football on Friday.", "يلعبون كرة القدم يوم الجمعة.", "A1"],
  ["This is my new phone.", "هذا هاتفي الجديد.", "A1"],
  ["Where is the train station?", "أين محطة القطار؟", "A1"],
  ["I have two brothers.", "لدي أخوان.", "A1"],
  ["The book is on the table.", "الكتاب على الطاولة.", "A1"],
  ["It is very cold outside.", "الجو بارد جدًا في الخارج.", "A1"],
  ["I like reading books.", "أحب قراءة الكتب.", "A1"],
  ["My father is a doctor.", "أبي طبيب.", "A1"],
  ["Can you help me, please?", "هل يمكنك مساعدتي من فضلك؟", "A1"],
  ["The shop opens at nine.", "يفتح المتجر في التاسعة.", "A1"],
  ["I am learning English.", "أنا أتعلم الإنجليزية.", "A1"],
  ["We eat dinner at eight.", "نتناول العشاء في الثامنة.", "A1"],
  ["I went to the market yesterday.", "ذهبت إلى السوق أمس.", "A2"],
  ["She has lived here for five years.", "تعيش هنا منذ خمس سنوات.", "A2"],
  ["We are going to travel next month.", "سنسافر الشهر القادم.", "A2"],
  ["He did not come to the meeting.", "لم يأتِ إلى الاجتماع.", "A2"],
  ["The children are playing in the garden.", "الأطفال يلعبون في الحديقة.", "A2"],
  ["I usually take the bus to work.", "عادةً أركب الحافلة إلى العمل.", "A2"],
  ["Could you send me the report?", "هل يمكنك إرسال التقرير إليّ؟", "A2"],
  ["My brother is taller than me.", "أخي أطول مني.", "A2"],
  ["I have never been to London.", "لم أذهب إلى لندن أبدًا.", "A2"],
  ["The film was really interesting.", "كان الفيلم ممتعًا حقًا.", "A2"],
  ["She is studying for her exam.", "إنها تذاكر لامتحانها.", "A2"],
  ["We need to buy some bread.", "نحتاج إلى شراء بعض الخبز.", "A2"],
  ["I will call you this evening.", "سأتصل بك هذا المساء.", "A2"],
  ["How much does this shirt cost?", "كم سعر هذا القميص؟", "A2"],
  ["The office is closed on Saturday.", "المكتب مغلق يوم السبت.", "A2"],
  ["I forgot my keys at home.", "نسيت مفاتيحي في المنزل.", "A2"],
  ["Please write your name here.", "من فضلك اكتب اسمك هنا.", "A2"],
  ["It takes ten minutes to walk there.", "يستغرق المشي إلى هناك عشر دقائق.", "A2"],
  ["My manager is in a meeting now.", "مديري في اجتماع الآن.", "A2"],
  ["I am interested in this job.", "أنا مهتم بهذه الوظيفة.", "A2"],
  ["Thank you for your quick reply.", "شكرًا على ردك السريع.", "B1"],
  ["I am writing to apply for the position.", "أكتب للتقدم لهذه الوظيفة.", "B1"],
  ["Please find the attached document.", "تجد المستند مرفقًا.", "B1"],
  ["I would appreciate your help with this.", "سأكون ممتنًا لمساعدتك في هذا.", "B1"],
  ["The project should be finished by Friday.", "يجب أن ينتهي المشروع بحلول الجمعة.", "B1"],
  ["If it rains, we will stay at home.", "إذا أمطرت، سنبقى في المنزل.", "B1"],
  ["I have been working here since March.", "أعمل هنا منذ مارس.", "B1"],
  ["Could we move the meeting to Tuesday?", "هل يمكننا نقل الاجتماع إلى الثلاثاء؟", "B1"],
  ["I apologize for the delay in my response.", "أعتذر عن التأخر في الرد.", "B1"],
  ["Learning to type takes time and practice.", "تعلم الكتابة على لوحة المفاتيح يحتاج إلى وقت وتمرين.", "B1"],
  ["She explained the problem very clearly.", "شرحت المشكلة بوضوح شديد.", "B1"],
  ["We should discuss this before the deadline.", "يجب أن نناقش هذا قبل الموعد النهائي.", "B1"],
  ["He has already finished his homework.", "لقد أنهى واجبه بالفعل.", "B1"],
  ["Let me know if you have any questions.", "أخبرني إذا كان لديك أي أسئلة.", "B1"],
  ["The results were better than we expected.", "كانت النتائج أفضل مما توقعنا.", "B1"],
  ["I am looking forward to hearing from you.", "أتطلع إلى سماع ردك.", "B1"],
  ["Our team is responsible for customer support.", "فريقنا مسؤول عن دعم العملاء.", "B1"],
  ["Writing every day improves your spelling.", "الكتابة كل يوم تحسّن إملاءك.", "B1"],
  ["I could not attend because I was ill.", "لم أستطع الحضور لأنني كنت مريضًا.", "B1"],
  ["Please confirm your booking by email.", "من فضلك أكّد حجزك عبر البريد الإلكتروني.", "B1"],
];

const toItems = (rows: readonly Row[], kind: TypingItem["kind"], prefix: string): TypingItem[] =>
  rows.map(([text, ar, level], i) => ({ id: `${prefix}-${i + 1}`, kind, text, ar, level }));

export const typingPhrases: readonly TypingItem[] = toItems(PHRASES, "phrase", "phrase");
export const typingSentences: readonly TypingItem[] = toItems(SENTENCES, "sentence", "sentence");

/** High-frequency English words for the "words" test mode and adaptive drills. */
export const commonWords: readonly string[] = (
  "the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are has had did said made went find tell ask seem feel try leave call keep let begin show hear play run move live believe hold bring happen write sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak read spend grow open walk win teach offer remember love consider appear buy wait serve die send build stay fall cut reach kill remain suggest raise pass sell decide return explain hope develop carry break receive agree support hit produce eat cover catch draw choose cause point listen water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city name team minute idea kid body back parent face others level office door health person art war history party result morning reason research girl guy moment air teacher force education"
).split(" ");

export const typingContent = { phrases: typingPhrases, sentences: typingSentences, words: commonWords };
