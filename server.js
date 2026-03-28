const express = require("express");
const cors = require("cors");
const path = require("path");
const https = require("https");
require("dotenv").config();
const Groq = require("groq-sdk");

// Support fetch on older Node versions
const _fetch = typeof fetch !== "undefined" ? fetch : (url, opts) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { hostname: u.hostname, path: u.pathname + u.search, headers: (opts && opts.headers) || {} };
    https.get(options, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve({ json: () => Promise.resolve(JSON.parse(d)), ok: true }));
    }).on("error", reject);
  });
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ══════════════════════════════════════════════════════════════
//  WIKIPEDIA API — using fetch (works on Railway)
// ══════════════════════════════════════════════════════════════
async function fetchWikipedia(query) {
  try {
    // Clean the question to extract the health topic
    const cleaned = query
      .replace(/what is|what are|how does|how do|why is|why are|tell me about|explain|define|meaning of|what do you mean by/gi, "")
      .replace(/[?!.,]/g, "")
      .trim();

    // Step 1: Search Wikipedia
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleaned)}&format=json&srlimit=3&utf8=1&origin=*`;

    const searchRes = await _fetch(searchUrl, {
      headers: { "User-Agent": "HealthQ/1.0 (college-project)" }
    });
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    // Pick best matching article
    let pageTitle = results[0].title;
    for (const r of results) {
      const t = r.title.toLowerCase();
      if (t.includes("disease") || t.includes("syndrome") || t.includes("disorder") ||
          t.includes("infection") || t.includes("vitamin") || t.includes("health") ||
          t.includes("cancer") || t.includes("diabetes") || t.includes("fever") ||
          t.includes("virus") || t.includes("bacteria") || t.includes("medicine")) {
        pageTitle = r.title;
        break;
      }
    }

    // Step 2: Get the summary of that article
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryRes = await _fetch(summaryUrl, {
      headers: { "User-Agent": "HealthQ/1.0 (college-project)" }
    });
    const page = await summaryRes.json();
    const extract = page?.extract;
    if (!extract || extract.length < 40) return null;

    return { title: page.title, extract };
  } catch (err) {
    console.error("Wikipedia error:", err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  GROQ — simplify Wikipedia answer into easy 2-3 lines
// ══════════════════════════════════════════════════════════════
async function simplifyWithGroq(wikiExtract, question, language, history) {
  const isHindi = language === "hi";

  const systemPrompt = isHindi
    ? `You are a health assistant. CRITICAL: Reply ONLY in Hindi Devanagari script. Never use English. Summarize the given Wikipedia text to answer the question in 2-3 simple Hindi sentences. Easy words only. No jargon.`
    : `You are a helpful health assistant. Use the given Wikipedia information to answer the question in 2-3 simple, clear sentences. Easy words only. No jargon. No warnings.`;

  const userContent = isHindi
    ? `Wikipedia जानकारी: "${wikiExtract}"\n\nसवाल: ${question}\n\n[केवल हिंदी में जवाब दें। अंग्रेज़ी बिल्कुल नहीं।]`
    : `Wikipedia info: "${wikiExtract}"\n\nQuestion: ${question}\n\nAnswer in 2-3 simple sentences using the Wikipedia info above.`;

  const recentHistory = history.slice(-4);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 200,
    messages: [
      { role: "system", content: systemPrompt },
      ...recentHistory.slice(0, -1),
      { role: "user", content: userContent }
    ],
  });
  return completion.choices[0].message.content.trim();
}

// ══════════════════════════════════════════════════════════════
//  GROQ — direct answer when Wikipedia has nothing
// ══════════════════════════════════════════════════════════════
async function groqDirectAnswer(messages, language) {
  const isHindi = language === "hi";

  const systemPrompt = isHindi
    ? `You are a health assistant. CRITICAL: Reply ONLY in Hindi Devanagari script. Never use English words. Answer in 2-3 simple Hindi sentences. Easy words only. No jargon. No warnings.`
    : `You are a helpful health assistant. Answer in 2-3 simple clear sentences. Easy words only. No jargon. No warnings. No disclaimers.`;

  const processedMessages = messages.slice(-6).map(msg => {
    if (isHindi && msg.role === "user") {
      return { ...msg, content: msg.content + "\n[Reply in Hindi Devanagari only. No English.]" };
    }
    return msg;
  });

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

  // Step 1 — Try Wikipedia
  const wikiResult = await fetchWikipedia(question);

  if (wikiResult) {
    // Step 2a — Wikipedia found something → Groq simplifies it
    try {
      const answer = await simplifyWithGroq(wikiResult.extract, question, language, messages);
      return res.json({ success: true, question, answer, source: "wikipedia" });
    } catch (err) {
      console.error("Groq simplify error:", err.message);
      // Fall through to direct Groq
    }
  }

  // Step 2b — Wikipedia found nothing → Groq answers directly
  try {
    const answer = await groqDirectAnswer(messages, language);
    return res.json({ success: true, question, answer, source: "ai" });
  } catch (err) {
    console.error("Groq direct error:", err.message);
    return res.status(500).json({ success: false, error: "Could not get an answer. Please try again." });
  }
});

app.get("/api/questions", (req, res) => {
  res.json({ success: true, total: "Wikipedia — unlimited topics" });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("✅ HealthQ running!");
  console.log("🌐 Wikipedia + Groq LLaMA 3.1 8B Instant ready!");
});
