import type { Scenario } from "./schema";

/** Real-life professional writing scenarios. Model answers use American spelling. */
export const scenarios: readonly Scenario[] = [
  {
    id: "manager-day-off",
    level: "A2",
    titleAr: "بريد إلى مديرك لطلب إجازة",
    titleEn: "Email to your manager asking for a day off",
    briefAr: "اكتب بريدًا قصيرًا لمديرك تطلب فيه إجازة يوم واحد. اذكر اليوم والسبب، وكيف سيستمر العمل في غيابك.",
    briefEn: "Write a short email to your manager asking for one day off. Say which day, why, and how your work will be covered.",
    minWords: 40,
    maxWords: 130,
    mustMention: [
      { labelAr: "اليوم أو التاريخ", labelEn: "the day or date", anyOf: ["@day", "@date", "date"] },
      { labelAr: "السبب", labelEn: "the reason", anyOf: ["because", "reason", "appointment", "family", "personal"] },
      { labelAr: "من سيغطي عملك", labelEn: "who will cover your work", anyOf: ["cover", "colleague", "handle", "take care of", "available", "instead of me"] },
    ],
    modelAnswer: `Dear Mr. Khalid,

I would like to ask for a day off on Thursday, 14 March, because I have a family appointment that I cannot move.

I will finish the weekly report before Wednesday evening, and Sara has kindly agreed to cover my emails while I am away. I will also be available by phone for anything urgent.

Please let me know if this is possible. Thank you for your understanding.

Best regards,
Omar Hassan`,
  },
  {
    id: "job-application",
    level: "B1",
    titleAr: "رسالة تقدّم لوظيفة",
    titleEn: "Job application message",
    briefAr: "اكتب رسالة قصيرة ترافق سيرتك الذاتية للتقدم لوظيفة «موظف خدمة عملاء». اذكر الوظيفة وخبرتك وأنك أرفقت السيرة الذاتية.",
    briefEn: "Write a short message to go with your CV for a Customer Service Assistant job. Mention the position, your experience and that your CV is attached.",
    minWords: 60,
    maxWords: 180,
    mustMention: [
      { labelAr: "اسم الوظيفة", labelEn: "the position", anyOf: ["position", "job", "role", "customer service"] },
      { labelAr: "خبرتك", labelEn: "your experience", anyOf: ["experience", "worked", "years"] },
      { labelAr: "السيرة الذاتية المرفقة", labelEn: "the attached CV", anyOf: ["cv", "resume", "attached", "attach"] },
    ],
    modelAnswer: `Dear Hiring Manager,

I am writing to apply for the Customer Service Assistant position that I saw on your website.

I have two years of experience in a busy call center, where I answered customer questions by phone and email and helped solve problems quickly. I am patient, organized and comfortable using computer systems. I speak Arabic and English.

Please find my CV attached. I would be grateful for the opportunity to discuss how I can support your team.

Thank you for your time and consideration.

Kind regards,
Mariam Saleh`,
  },
  {
    id: "linkedin-connection",
    level: "A2",
    titleAr: "رسالة تواصل على LinkedIn",
    titleEn: "LinkedIn connection message",
    briefAr: "اكتب رسالة قصيرة لشخص في مجالك على LinkedIn. عرّف بنفسك واذكر سبب رغبتك في التواصل.",
    briefEn: "Write a short LinkedIn message to someone in your field. Introduce yourself and say why you would like to connect.",
    minWords: 25,
    maxWords: 90,
    mustMention: [
      { labelAr: "من أنت", labelEn: "who you are", anyOf: ["my name", "i am", "i work", "i'm"] },
      { labelAr: "سبب التواصل", labelEn: "why you want to connect", anyOf: ["connect", "learn", "advice", "interested", "network"] },
    ],
    modelAnswer: `Hello Ms. Rana,

My name is Youssef, and I am a junior web developer in Amman. I enjoyed your recent article about accessible design and learned a lot from it.

I would be happy to connect and follow your work. Thank you for sharing your experience.

Best wishes,
Youssef`,
  },
  {
    id: "customer-reply",
    level: "B1",
    titleAr: "رد على شكوى عميل",
    titleEn: "Reply to a customer complaint",
    briefAr: "عميل اشتكى من تأخر طلبه. اكتب ردًا تعتذر فيه، وتشرح ما حدث باختصار، وتخبره متى سيصله الطلب.",
    briefEn: "A customer complained that their order is late. Reply with an apology, a short explanation and when the order will arrive.",
    minWords: 50,
    maxWords: 150,
    mustMention: [
      { labelAr: "اعتذار", labelEn: "an apology", anyOf: ["sorry", "apologize", "apologise", "apologies"] },
      { labelAr: "موعد الوصول", labelEn: "when it will arrive", anyOf: ["arrive", "deliver", "delivery", "@day", "@date"] },
      { labelAr: "رقم الطلب", labelEn: "the order number", anyOf: ["@number", "order number"] },
    ],
    modelAnswer: `Dear Mr. Ahmed,

Thank you for contacting us, and I am very sorry that your order 4521 is late.

There was a delay at our warehouse this week. I have checked your order, and it was shipped this morning. It will be delivered on Wednesday before 6 p.m. You will receive a tracking link by email today.

We apologize for the inconvenience. Please reply to this email if there is anything else I can do for you.

Kind regards,
Lina Haddad
Customer Service Team`,
  },
  {
    id: "polite-follow-up",
    level: "B1",
    titleAr: "متابعة مهذبة",
    titleEn: "Polite follow-up",
    briefAr: "أرسلت طلبًا قبل أسبوع ولم تحصل على رد. اكتب رسالة متابعة مهذبة تذكّر فيها بالطلب وتسأل عن الخطوة التالية.",
    briefEn: "You sent a request a week ago and have had no reply. Write a polite follow-up reminding them of the request and asking about the next step.",
    minWords: 35,
    maxWords: 120,
    mustMention: [
      { labelAr: "الطلب السابق", labelEn: "the earlier request", anyOf: ["sent", "request", "last week", "previous", "earlier"] },
      { labelAr: "الخطوة التالية", labelEn: "the next step", anyOf: ["next step", "update", "news", "decision", "hear from you", "let me know"] },
    ],
    modelAnswer: `Hello Mr. Tariq,

I hope you are well. I am following up on the quotation request that I sent you last Monday for 200 office chairs.

Could you please give me an update on the price and delivery time? We would like to make a decision before the end of the month.

Thank you for your help. I look forward to hearing from you.

Best regards,
Nadia Fawzi`,
  },
  {
    id: "apology-missed-meeting",
    level: "A2",
    titleAr: "اعتذار عن تفويت اجتماع",
    titleEn: "Apology for missing a meeting",
    briefAr: "فاتك اجتماع مهم مع زميل. اكتب رسالة اعتذار قصيرة، واذكر السبب، واقترح موعدًا جديدًا.",
    briefEn: "You missed an important meeting with a colleague. Write a short apology, give the reason and suggest a new time.",
    minWords: 30,
    maxWords: 110,
    mustMention: [
      { labelAr: "اعتذار", labelEn: "an apology", anyOf: ["sorry", "apologize", "apologise", "apologies"] },
      { labelAr: "موعد جديد", labelEn: "a new time", anyOf: ["@day", "@date", "@time", "reschedule"] },
    ],
    modelAnswer: `Dear Hana,

I am very sorry that I missed our meeting this morning. My train was delayed for over an hour, and my phone battery was empty, so I could not call you.

Would tomorrow at 10 a.m. work for you? I can also meet on Thursday afternoon if that is easier.

Thank you for your patience.

Best regards,
Karim`,
  },
  {
    id: "meeting-request",
    level: "A2",
    titleAr: "طلب موعد اجتماع",
    titleEn: "Meeting request",
    briefAr: "اطلب اجتماعًا مدته 30 دقيقة مع مدير قسم آخر لمناقشة مشروع مشترك. اقترح وقتين واذكر الهدف.",
    briefEn: "Ask the head of another department for a 30-minute meeting about a shared project. Suggest two times and say what it is for.",
    minWords: 35,
    maxWords: 120,
    mustMention: [
      { labelAr: "هدف الاجتماع", labelEn: "the purpose", anyOf: ["discuss", "project", "plan", "talk about", "review"] },
      { labelAr: "وقت مقترح", labelEn: "a suggested time", anyOf: ["@day", "@date", "@time"] },
    ],
    modelAnswer: `Dear Mr. Nabil,

I would like to schedule a 30-minute meeting with you to discuss the new training project that our two departments will share.

Would Tuesday at 11 a.m. or Wednesday at 2 p.m. be convenient for you? I am happy to meet in your office or online.

Please let me know which time suits you best. Thank you.

Kind regards,
Salma Adel
Human Resources`,
  },
  {
    id: "thank-you-interview",
    level: "A2",
    titleAr: "رسالة شكر بعد مقابلة عمل",
    titleEn: "Thank-you note after an interview",
    briefAr: "اكتب رسالة شكر قصيرة بعد مقابلة عمل. اشكرهم على وقتهم، واذكر شيئًا أعجبك في المقابلة، وأكّد اهتمامك بالوظيفة.",
    briefEn: "Write a short thank-you note after a job interview. Thank them for their time, mention something you liked, and confirm your interest in the job.",
    minWords: 30,
    maxWords: 110,
    mustMention: [
      { labelAr: "الشكر", labelEn: "thanks", anyOf: ["thank"] },
      { labelAr: "اهتمامك بالوظيفة", labelEn: "your interest in the job", anyOf: ["interested", "excited", "role", "position", "job", "opportunity"] },
    ],
    modelAnswer: `Dear Ms. Laila,

Thank you for meeting with me yesterday to talk about the Office Coordinator position. I enjoyed learning about your team and your plans for the new office.

I am very interested in the role, and I believe my organization skills would help the team. Please let me know if you need any more information from me.

Best regards,
Reem Mansour`,
  },
  {
    id: "colleague-help",
    level: "A1",
    titleAr: "طلب مساعدة من زميل",
    titleEn: "Asking a colleague for help",
    briefAr: "اطلب من زميلك أن يساعدك في استخدام برنامج جديد. اذكر المشكلة واقترح وقتًا.",
    briefEn: "Ask a colleague to help you use a new program. Say what the problem is and suggest a time.",
    minWords: 25,
    maxWords: 90,
    mustMention: [
      { labelAr: "المشكلة", labelEn: "the problem", anyOf: ["problem", "how to", "cannot", "can't", "don't know", "help"] },
      { labelAr: "وقت مقترح", labelEn: "a suggested time", anyOf: ["@day", "@time", "minutes", "after lunch"] },
    ],
    modelAnswer: `Hi Ali,

I hope your week is going well. I have a problem with the new booking program, and I do not know how to change a reservation.

Could you please show me how it works? Ten minutes today after lunch would be perfect for me.

Thank you very much.

Best,
Mona`,
  },
];
