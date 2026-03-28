const express = require("express");
const cors = require("cors");
const path = require("path");
const https = require("https");
require("dotenv").config();
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ══════════════════════════════════════════════════════════════
//  WIKIPEDIA API — fetch best health summary for any question
// ══════════════════════════════════════════════════════════════
function fetchWikipedia(query) {
  return new Promise((resolve) => {
    // Clean query — remove question words, keep the health topic
    const cleaned = query
      .toLowerCase()
      .replace(/what is|what are|how does|how do|why is|why are|tell me about|explain|define|meaning of|what do you mean by/gi, "")
      .replace(/[?!.,]/g, "")
      .trim();

    const searchQuery = encodeURIComponent(cleaned);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=3&utf8=1`;

    https.get(searchUrl, { headers: { "User-Agent": "HealthQ/1.0" } }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const results = json?.query?.search;
          if (!results || results.length === 0) return resolve(null);

          // Pick the best result — prefer health/medical related titles
          let pageTitle = results[0].title;
          for (const r of results) {
            const t = r.title.toLowerCase();
            if (t.includes("disease") || t.includes("syndrome") || t.includes("disorder") ||
                t.includes("infection") || t.includes("vitamin") || t.includes("health") ||
                t.includes("medical") || t.includes("cancer") || t.includes("diabetes")) {
              pageTitle = r.title;
              break;
            }
          }

          // Fetch the summary of that Wikipedia article
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
          https.get(summaryUrl, { headers: { "User-Agent": "HealthQ/1.0" } }, (res2) => {
            let data2 = "";
            res2.on("data", chunk => data2 += chunk);
            res2.on("end", () => {
              try {
                const page = JSON.parse(data2);
                const extract = page?.extract;
                if (!extract || extract.length < 40) return resolve(null);
                // Return full extract — Groq will simplify it
                resolve({ title: page.title, extract });
              } catch { resolve(null); }
            });
          }).on("error", () => resolve(null));

        } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

// ══════════════════════════════════════════════════════════════
//  GROQ — simplify Wikipedia text into easy 2-3 lines
// ══════════════════════════════════════════════════════════════
async function simplifyWithGroq(wikiExtract, question, language, conversationHistory) {
  const isHindi = language === "hi";

  const systemPrompt = isHindi
    ? `You are a health assistant. CRITICAL RULE: You MUST reply ONLY in Hindi (Devanagari script). Never use English. Not even one English word.
Use the Wikipedia information provided to answer the user's question in 2-3 simple Hindi sentences.
Use very easy Hindi words that anyone can understand. No medical jargon. No warnings. No disclaimers.`
    : `You are a helpful health assistant. Use the Wikipedia information provided to answer the user's question in 2-3 simple, clear sentences.
Use easy words anyone can understand. No medical jargon. No warnings. No disclaimers. Be warm and friendly.`;

  const userContent = isHindi
    ? `Wikipedia की जानकारी:\n"${wikiExtract}"\n\nसवाल: ${question}\n\n[IMPORTANT: Answer ONLY in Hindi Devanagari script. No English words at all.]`
    : `Wikipedia information:\n"${wikiExtract}"\n\nQuestion: ${question}\n\nUsing the above Wikipedia info, answer the question in 2-3 simple sentences.`;

  // Keep last 4 messages of history for context
  const recentHistory = conversationHistory.slice(-4).map(msg => {
    if (msg.role === "user" && isHindi) {
      return { ...msg, content: msg.content + "\n[Reply in Hindi only]" };
    }
    return msg;
  });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 200,
    messages: [
      { role: "system", content: systemPrompt },
      ...recentHistory.slice(0, -1), // previous history except current question
      { role: "user", content: userContent }
    ],
  });
  return completion.choices[0].message.content.trim();
}

// ══════════════════════════════════════════════════════════════
//  GROQ — answer directly when Wikipedia has nothing
// ══════════════════════════════════════════════════════════════
async function groqDirectAnswer(messages, language) {
  const isHindi = language === "hi";

  const systemPrompt = isHindi
    ? `You are a health assistant. CRITICAL RULE: You MUST reply ONLY in Hindi (Devanagari script). Never use English. Not even one English word in your answer.
Answer health questions in 2-3 simple Hindi sentences. Easy words only. No jargon. No warnings.`
    : `You are a helpful health assistant. Answer in 2-3 simple, clear sentences. Easy words only. No medical jargon. No warnings. No disclaimers.`;

  const processedMessages = isHindi
    ? messages.slice(-6).map(msg => {
        if (msg.role === "user") {
          return { ...msg, content: msg.content + "\n[IMPORTANT: Answer in Hindi Devanagari script only. No English.]" };
        }
        return msg;
      })
    : messages.slice(-6);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 200,
    messages: [
      { role: "system", content: systemPrompt },
      ...processedMessages
    ],
  });
  return completion.choices[0].message.content.trim();
}

// ══════════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/ask", async (req, res) => {
  const { question, messages = [], language = "en" } = req.body;

  if (!question || question.trim() === "")
    return res.status(400).json({ success: false, error: "Please provide a question." });

  // ── Step 1: Always search Wikipedia first ──────────────────
  let wikiResult = null;
  try {
    wikiResult = await fetchWikipedia(question);
  } catch (err) {
    console.error("Wikipedia fetch error:", err.message);
  }

  // ── Step 2a: Wikipedia found something → Groq simplifies it ─
  if (wikiResult) {
    try {
      const answer = await simplifyWithGroq(
        wikiResult.extract,
        question,
        language,
        messages
      );
      return res.json({
        success: true,
        question,
        answer,
        source: "wikipedia"
      });
    } catch (err) {
      console.error("Groq simplify error:", err.message);
      // Fall through to direct Groq answer
    }
  }

  // ── Step 2b: Wikipedia found nothing → Groq answers directly ─
  try {
    const answer = await groqDirectAnswer(messages, language);
    return res.json({
      success: true,
      question,
      answer,
      source: "ai"
    });
  } catch (err) {
    console.error("Groq direct error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Could not get an answer. Please try again."
    });
  }
});

app.get("/api/questions", (req, res) => {
  res.json({ success: true, total: "Wikipedia — unlimited" });
});

app.listen(3000, () => {
  console.log("✅ HealthQ server running at http://localhost:3000");
  console.log("🌐 Wikipedia API + Groq LLaMA 3.1 8B Instant ready!");
});
