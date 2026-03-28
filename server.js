const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const Groq = require("groq-sdk");
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── 100+ Health Q&A Bank ─────────────────────────────────────────────────────
const qaBank = [
  { keys: ["bones","body","human","how many"], answer: "An adult human body has 206 bones. Babies are born with around 270 that fuse over time." },
  { keys: ["muscles","body","how many"], answer: "The human body has over 600 muscles. They make up about 40% of your body weight." },
  { keys: ["ribs","human","how many"], answer: "Humans have 24 ribs in total, 12 on each side of the chest." },
  { keys: ["longest","bone"], answer: "The femur (thigh bone) is the longest bone in the human body." },
  { keys: ["smallest","bone"], answer: "The stapes bone in the ear is the smallest bone, only about 3mm long." },
  { keys: ["spine","vertebrae","backbone"], answer: "The human spine has 33 vertebrae divided into 5 regions." },
  { keys: ["teeth","adults","how many"], answer: "Adults have 32 teeth including 4 wisdom teeth." },
  { keys: ["heart","chambers","how many"], answer: "The human heart has 4 chambers, 2 atria on top and 2 ventricles on the bottom." },
  { keys: ["heart","beat","day","how many"], answer: "The heart beats about 100,000 times every single day." },
  { keys: ["heart","pump","blood","day"], answer: "The heart pumps about 7,500 liters of blood every single day." },
  { keys: ["heart","rate","normal","beats"], answer: "A normal resting heart rate is 60 to 100 beats per minute for adults." },
  { keys: ["blood","liters","body","how much"], answer: "The human body contains about 4.7 to 5.5 liters of blood." },
  { keys: ["blood","pressure","normal"], answer: "Normal blood pressure is 120/80 mmHg. Above 140/90 is considered high." },
  { keys: ["blood","fast","travel","speed"], answer: "Blood travels about 1 meter per second through the aorta, the body's main artery." },
  { keys: ["red blood cells","function"], answer: "Red blood cells carry oxygen from the lungs to all parts of the body." },
  { keys: ["white blood cells","function"], answer: "White blood cells fight infections and protect the body against diseases." },
  { keys: ["platelets","what"], answer: "Platelets are tiny blood cells that help blood clot when you get a cut." },
  { keys: ["blood sugar","normal","level"], answer: "Normal fasting blood sugar is 70 to 100 mg/dL. Above 126 may indicate diabetes." },
  { keys: ["cholesterol","what"], answer: "Cholesterol is a fat-like substance in the blood. Too much of it can block arteries." },
  { keys: ["brain","cells","neurons","how many"], answer: "The human brain has about 86 billion neurons (brain cells)." },
  { keys: ["brain","weigh","weight","how much"], answer: "The human brain weighs about 1.4 kg or 3 pounds on average." },
  { keys: ["brain","function","what does"], answer: "The brain controls all body functions, thoughts, emotions, and processes all information." },
  { keys: ["organs","body","how many"], answer: "The human body has 78 organs. The skin is the largest organ." },
  { keys: ["largest","organ"], answer: "The skin is the largest organ. It covers the entire body and protects it." },
  { keys: ["lungs","how many"], answer: "Humans have 2 lungs. The right lung has 3 lobes and the left has 2 lobes." },
  { keys: ["lungs","function"], answer: "Lungs take in oxygen when you breathe in and remove carbon dioxide when you breathe out." },
  { keys: ["kidneys","how many"], answer: "Humans have 2 kidneys. They filter about 200 liters of blood every day." },
  { keys: ["kidney","function"], answer: "Kidneys filter waste from the blood and remove it from the body as urine." },
  { keys: ["liver","function"], answer: "The liver filters blood, produces bile for digestion, and removes toxins from the body." },
  { keys: ["heart","function"], answer: "The heart pumps blood throughout the body, delivering oxygen and nutrients to all organs." },
  { keys: ["intestines","long","how long"], answer: "The small intestine is about 6 meters and the large intestine is about 1.5 meters long." },
  { keys: ["appendix","what"], answer: "The appendix is a small organ attached to the large intestine. Its exact function is not fully known." },
  { keys: ["stomach","function"], answer: "The stomach breaks down food using acid and enzymes before passing it to the intestines." },
  { keys: ["pancreas","function"], answer: "The pancreas produces insulin to control blood sugar and digestive enzymes to break down food." },
  { keys: ["body","temperature","normal"], answer: "Normal body temperature is 98.6°F or 37°C. Slight variation throughout the day is normal." },
  { keys: ["dna","what"], answer: "DNA is the molecule that carries genetic information in all living things. It determines your traits." },
  { keys: ["calories","eat","per day","how many"], answer: "An average adult needs about 2000 to 2500 calories per day depending on activity level." },
  { keys: ["water","drink","daily","how much"], answer: "You should drink about 8 glasses or 2 liters of water per day to stay hydrated." },
  { keys: ["sleep","hours","adults","how many"], answer: "Adults need 7 to 9 hours of sleep per night for good health." },
  { keys: ["bmi","what"], answer: "BMI is Body Mass Index, a number calculated from height and weight to check if your weight is healthy." },
  { keys: ["diabetes","what"], answer: "Diabetes is a condition where the body cannot properly control blood sugar levels." },
  { keys: ["hypertension","what"], answer: "Hypertension means high blood pressure, when blood pushes too hard against artery walls." },
  { keys: ["anemia","what"], answer: "Anemia is when you have too few red blood cells, causing tiredness and weakness." },
  { keys: ["asthma","what"], answer: "Asthma is a condition where airways become narrow and swollen, making breathing difficult." },
  { keys: ["cancer","what"], answer: "Cancer is when cells in the body grow out of control, forming tumors or invading other tissues." },
  { keys: ["arthritis","what"], answer: "Arthritis is inflammation of the joints, causing pain, swelling, and stiffness." },
  { keys: ["alzheimer","what"], answer: "Alzheimer's is a brain disease that causes memory loss and confusion, mainly in older people." },
  { keys: ["depression","what"], answer: "Depression is a mental health condition causing persistent sadness, low energy, and loss of interest." },
  { keys: ["fever","what","is"], answer: "Fever is when body temperature rises above 100.4°F (38°C), usually as a sign of infection or illness." },
  { keys: ["fever","high","dangerous"], answer: "A fever above 103°F (39.4°C) in adults is considered high and needs medical attention." },
  { keys: ["fever","cause","why"], answer: "Fever is caused by the immune system fighting infections like bacteria, viruses, or other illnesses." },
  { keys: ["fever","reduce","lower","how"], answer: "Fever can be reduced by resting, drinking fluids, and taking medicines like paracetamol or ibuprofen." },
  { keys: ["fever","normal","temperature"], answer: "Normal body temperature is 98.6°F. A fever starts when temperature rises above 100.4°F (38°C)." },
  { keys: ["vaccine","what","is"], answer: "A vaccine is a substance given to the body to teach the immune system to fight a specific disease." },
  { keys: ["vaccine","how","work"], answer: "Vaccines train your immune system by introducing a harmless version of a germ so your body learns to fight it." },
  { keys: ["vaccine","safe","are"], answer: "Vaccines go through extensive testing before approval and are considered safe and effective by medical experts." },
  { keys: ["vaccine","covid","corona"], answer: "COVID-19 vaccines protect against severe illness from the coronavirus by training the immune system." },
  { keys: ["vaccine","polio"], answer: "The polio vaccine protects against poliomyelitis, a disease that can cause paralysis. It has nearly wiped out polio worldwide." },
  { keys: ["vaccine","flu","influenza"], answer: "The flu vaccine protects against influenza. It is recommended every year as the virus changes." },
  { keys: ["vaccine","types","kinds"], answer: "There are 4 main types of vaccines: live-attenuated, inactivated, subunit, and mRNA vaccines." },
  { keys: ["fat","what","is","body"], answer: "Body fat is stored energy. It also protects organs, regulates hormones, and keeps the body warm." },
  { keys: ["fat","good","bad","types"], answer: "Healthy fats (unsaturated) are found in nuts and avocado. Unhealthy fats (saturated/trans) are found in junk food." },
  { keys: ["fat","how much","body","percentage"], answer: "Healthy body fat is 10-20% for men and 18-28% for women. Too much or too little is harmful." },
  { keys: ["fat","burn","how","lose"], answer: "Fat is burned when you use more calories than you eat, especially through exercise and a healthy diet." },
  { keys: ["obesity","what","is"], answer: "Obesity is when body fat is dangerously high, usually with BMI above 30. It raises risk of many diseases." },
  { keys: ["protein","what","is"], answer: "Protein is a nutrient that builds and repairs muscles, tissues, and makes enzymes and hormones." },
  { keys: ["protein","how much","daily"], answer: "An average adult needs about 0.8 grams of protein per kg of body weight daily." },
  { keys: ["carbohydrates","what","are"], answer: "Carbohydrates are the body's main energy source, found in rice, bread, fruits, and vegetables." },
  { keys: ["sugar","much","daily"], answer: "The recommended daily sugar limit is about 25 grams for women and 36 grams for men." },
  { keys: ["salt","sodium","daily","how much"], answer: "Adults should consume less than 2,300 mg (about 1 teaspoon) of salt per day." },
  { keys: ["vitamins","what","are"], answer: "Vitamins are nutrients the body needs in small amounts to function, grow, and stay healthy." },
  { keys: ["vitamin","c","good","for"], answer: "Vitamin C boosts the immune system and helps the body fight infections and heal wounds." },
  { keys: ["vitamin","d","good","for"], answer: "Vitamin D helps the body absorb calcium for strong bones and also supports the immune system." },
  { keys: ["immune","system","what"], answer: "The immune system is the body's defense network that fights germs, viruses, and diseases." },
  { keys: ["immune","system","boost","how"], answer: "You can boost immunity by eating well, sleeping enough, exercising, and reducing stress." },
  { keys: ["virus","what","is"], answer: "A virus is a tiny particle that invades body cells and causes infections like cold, flu, or COVID." },
  { keys: ["bacteria","what","is"], answer: "Bacteria are tiny single-celled organisms. Some cause disease, others are helpful to the body." },
  { keys: ["infection","what","is"], answer: "An infection is when harmful germs like bacteria or viruses enter the body and multiply." },
  { keys: ["antibiotic","what","is"], answer: "Antibiotics are medicines that kill or stop bacteria from growing. They do not work against viruses." },
  { keys: ["mental","health","what"], answer: "Mental health refers to emotional, psychological, and social wellbeing. It affects how we think and feel." },
  { keys: ["stress","what","is"], answer: "Stress is the body's response to pressure or threats. Short-term stress is normal but chronic stress is harmful." },
  { keys: ["anxiety","what","is"], answer: "Anxiety is a feeling of worry or fear. When it becomes excessive and persistent, it may be an anxiety disorder." },
  { keys: ["skin","layers","how many"], answer: "The skin has 3 main layers: epidermis (outer), dermis (middle), and hypodermis (inner)." },
  { keys: ["hair","grow","how fast"], answer: "Human hair grows about 15 cm or 6 inches per year, roughly 1.25 cm per month." },
  { keys: ["nails","grow","how fast"], answer: "Fingernails grow about 3mm per month. Toenails grow slower at about 1.5mm per month." },
  { keys: ["eyes","color","why"], answer: "Eye color is determined by the amount of melanin in the iris. More melanin gives darker eyes." },
  { keys: ["ears","how","hear","hearing"], answer: "Sound waves enter the ear, vibrate the eardrum, and send signals to the brain through tiny bones and nerves." },
  { keys: ["pregnancy","months","how long"], answer: "Human pregnancy lasts about 9 months or 40 weeks from the last menstrual period." },
  { keys: ["baby","bones","how many"], answer: "Babies are born with about 270 bones. Many fuse together as they grow, leaving 206 in adulthood." },
  { keys: ["exercise","how much","daily","week"], answer: "Adults should get at least 150 minutes of moderate exercise per week for good health." },
  { keys: ["exercise","benefit","good"], answer: "Exercise strengthens the heart, builds muscle, improves mood, boosts immunity, and helps maintain weight." },
];

// ── Smart keyword matching ────────────────────────────────────────────────────
function findStaticAnswer(question) {
  const q = question.toLowerCase().replace(/[?!.,]/g, "");
  const words = q.split(/\s+/);
  let bestMatch = null, bestScore = 0;
  for (const entry of qaBank) {
    let score = 0;
    for (const keyword of entry.keys) {
      if (q.includes(keyword)) score += 2;
      else if (words.some(w => keyword.includes(w) && w.length > 3)) score += 1;
    }
    if (score > bestScore) { bestScore = score; bestMatch = entry.answer; }
  }
  return bestScore >= 2 ? bestMatch : null;
}

// ── Groq: always answer in the correct language ───────────────────────────────
async function getGroqAnswer(messages, language) {
  const isHindi = language === "hi";

  const systemPrompt = isHindi
    ? `You are a health assistant. CRITICAL RULE: You MUST reply ONLY in Hindi (Devanagari script). Never use English. Not even one English word in your answer. Always write in Hindi देवनागरी only. Answer in 2-4 simple sentences. Remember the conversation context.`
    : `You are a helpful health assistant. Always answer in clear simple English in 2-4 sentences. Remember the conversation and give natural follow-up answers. No medical jargon. No warnings. No disclaimers.`;

  // For Hindi: wrap every user message to reinforce the language rule
  const processedMessages = isHindi
    ? messages.map(msg => {
        if (msg.role === "user") {
          return {
            role: "user",
            content: msg.content + "

[IMPORTANT: Answer the above question in Hindi (Devanagari script) only. Do not use English at all.]"
          };
        }
        return msg;
      })
    : messages;

  const completion = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    max_tokens: 250,
    messages: [
      { role: "system", content: systemPrompt },
      ...processedMessages
    ],
  });
  return completion.choices[0].message.content.trim();
}

// ── Groq: translate a static English answer to Hindi ─────────────────────────
async function translateToHindi(englishText) {
  const completion = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: `You are a translator. CRITICAL: Translate the given English health fact into Hindi (Devanagari script) ONLY. Output ONLY the Hindi translation — no English words, no explanation, no extra text whatsoever.`
      },
      {
        role: "user",
        content: `Translate this English health fact to Hindi Devanagari script only (no English at all): "${englishText}"`
      }
    ],
  });
  return completion.choices[0].message.content.trim();
}

// ── Wikipedia API: fetch clean health summary ────────────────────────────────
function fetchWikipedia(query) {
  return new Promise((resolve) => {
    // Step 1: Search Wikipedia for the best matching article
    const searchQuery = encodeURIComponent(query + " health medicine");
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=1`;

    https.get(searchUrl, { headers: { "User-Agent": "HealthQ/1.0 (college project)" } }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const results = json?.query?.search;
          if (!results || results.length === 0) return resolve(null);

          const pageTitle = results[0].title;

          // Step 2: Fetch the summary of that article
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
          https.get(summaryUrl, { headers: { "User-Agent": "HealthQ/1.0 (college project)" } }, (res2) => {
            let data2 = "";
            res2.on("data", chunk => data2 += chunk);
            res2.on("end", () => {
              try {
                const page = JSON.parse(data2);
                // Only use if it looks like a real health/medical article
                const extract = page?.extract;
                if (!extract || extract.length < 30) return resolve(null);

                // Take first 2-3 sentences max, keep it short like other answers
                const sentences = extract.match(/[^.!?]+[.!?]+/g) || [];
                const short = sentences.slice(0, 3).join(" ").trim();
                resolve(short || null);
              } catch { resolve(null); }
            });
          }).on("error", () => resolve(null));
        } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/ask", async (req, res) => {
  const { question, messages = [], language = "en" } = req.body;

  if (!question || question.trim() === "")
    return res.status(400).json({ success: false, error: "Please provide a question." });

  const isHindi = language === "hi";

  // Layer 1: Try static Q&A bank (keyword match on English question)
  // Always attempt static lookup regardless of conversation length
  const staticAnswer = findStaticAnswer(question);

  if (staticAnswer) {
    if (isHindi) {
      // Translate the English static answer to Hindi via Groq
      try {
        const hindi = await translateToHindi(staticAnswer);
        return res.json({ success: true, question, answer: hindi, source: "static" });
      } catch (err) {
        console.error("Translation error:", err.message);
        // Translation failed — fall through to Groq chat below
      }
    } else {
      // English — return directly
      return res.json({ success: true, question, answer: staticAnswer, source: "static" });
    }
  }

  // Layer 2: Wikipedia API
  try {
    const wikiAnswer = await fetchWikipedia(question);
    if (wikiAnswer) {
      if (isHindi) {
        try {
          const hindiWiki = await translateToHindi(wikiAnswer);
          return res.json({ success: true, question, answer: hindiWiki, source: "wikipedia" });
        } catch {
          return res.json({ success: true, question, answer: wikiAnswer, source: "wikipedia" });
        }
      }
      return res.json({ success: true, question, answer: wikiAnswer, source: "wikipedia" });
    }
  } catch (err) {
    console.error("Wikipedia Error:", err.message);
  }

  // Layer 3: Groq AI with full conversation history (ultimate fallback)
  try {
    const aiAnswer = await getGroqAnswer(messages, language);
    return res.json({ success: true, question, answer: aiAnswer, source: "ai" });
  } catch (err) {
    console.error("Groq Error:", err.message);
    return res.status(500).json({ success: false, error: "Could not get an answer. Please try again." });
  }
});

app.get("/api/questions", (req, res) => {
  res.json({ success: true, total: qaBank.length });
});

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
  console.log("📚 " + qaBank.length + " static topics + Groq LLaMA 3 70B fallback");
});
