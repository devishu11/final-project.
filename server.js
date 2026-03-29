const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const Groq = require("groq-sdk");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.options("*", cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ══════════════════════════════════════════════════════════════
//  WIKIPEDIA — fetch summary for any health topic
// ══════════════════════════════════════════════════════════════
async function fetchWikipedia(query) {
  try {
    const cleaned = query
      .replace(/what is|what are|how does|how do|why is|tell me about|explain|define/gi, "")
      .replace(/[?!.,]/g, "")
      .trim();

    const searchUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
      encodeURIComponent(cleaned) + "&format=json&srlimit=3&utf8=1";

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    let pageTitle = results[0].title;
    for (const r of results) {
      const t = r.title.toLowerCase();
      if (t.includes("disease") || t.includes("syndrome") || t.includes("infection") ||
          t.includes("vitamin") || t.includes("cancer") || t.includes("fever") ||
          t.includes("virus") || t.includes("bacteria") || t.includes("disorder")) {
        pageTitle = r.title;
        break;
      }
    }

    const summaryUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(pageTitle);
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return null;
    const page = await summaryRes.json();
    const extract = page?.extract;
    if (!extract || extract.length < 40) return null;

    return { title: page.title, extract: extract.substring(0, 600) };
  } catch (err) {
    console.log("Wikipedia fetch failed:", err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  GROQ — simplify Wikipedia answer
// ══════════════════════════════════════════════════════════════
async function simplifyWithGroq(wikiExtract, question, language, history) {
  const isHindi = language === "hi";

  const systemPrompt = isHindi
    ? `You are a health assistant. CRITICAL: Reply ONLY in Hindi Devanagari script. Never use English. Use the Wikipedia text to answer in 2-3 simple Hindi sentences.`
    : `You are a helpful health assistant. Use the Wikipedia information to answer in 2-3 simple clear sentences. No jargon. No warnings.`;

  const userContent = isHindi
    ? `Wikipedia जानकारी: "${wikiExtract}"\n\nसवाल: ${question}\n\n[केवल हिंदी में जवाब दें।]`
    : `Wikipedia info: "${wikiExtract}"\n\nQuestion: ${question}\n\nAnswer in 2-3 simple sentences.`;

  const recentHistory = (history || []).slice(-4).slice(0, -1);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 200,
    messages: [
      { role: "system", content: systemPrompt },
      ...recentHistory,
      { role: "user", content: userContent }
    ],
  });
  return completion.choices[0].message.content.trim();
}

// ══════════════════════════════════════════════════════════════
//  GROQ — direct answer fallback
// ══════════════════════════════════════════════════════════════
async function groqDirectAnswer(messages, language) {
  const isHindi = language === "hi";

  const systemPrompt = isHindi
    ? `You are a health assistant. CRITICAL: Reply ONLY in Hindi Devanagari script. Never use English. Answer in 2-3 simple Hindi sentences.`
    : `You are a helpful health assistant. Answer in 2-3 simple clear sentences. No jargon. No warnings.`;

  const processedMessages = (messages || []).slice(-6).map(msg => {
    if (isHindi && msg.role === "user") {
      return { ...msg, content: msg.content + "\n[Reply ONLY in Hindi Devanagari. No English.]" };
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
  console.log("Request received:", req.body);
  
  try {
    const { question, messages, language } = req.body;
    const lang = language || "en";
    const msgs = messages || [];

    if (!question || question.trim() === "") {
      return res.status(400).json({ success: false, error: "Please provide a question." });
    }

    console.log("Question:", question, "| Language:", lang);

    // Step 1: Try Wikipedia
    let wikiResult = null;
    try {
      wikiResult = await fetchWikipedia(question);
      console.log("Wikipedia result:", wikiResult ? wikiResult.title : "none");
    } catch (e) {
      console.log("Wikipedia error:", e.message);
    }

    // Step 2a: Wikipedia found → Groq simplifies
    if (wikiResult) {
      try {
        const answer = await simplifyWithGroq(wikiResult.extract, question, lang, msgs);
        console.log("Answer from Wikipedia+Groq:", answer.substring(0, 50));
        return res.json({ success: true, question, answer, source: "wikipedia" });
      } catch (e) {
        console.log("Groq simplify error:", e.message);
      }
    }

    // Step 2b: Groq direct fallback
    try {
      const answer = await groqDirectAnswer(msgs, lang);
      console.log("Answer from Groq direct:", answer.substring(0, 50));
      return res.json({ success: true, question, answer, source: "ai" });
    } catch (e) {
      console.log("Groq direct error:", e.message);
      return res.status(500).json({ success: false, error: "Could not get an answer. Please try again." });
    }

  } catch (err) {
    console.error("UNHANDLED ERROR in /api/ask:", err.message);
    return res.status(500).json({ success: false, error: "Server error. Please try again." });
  }
});

app.get("/api/questions", (req, res) => {
  res.json({ success: true, total: "Wikipedia — unlimited topics" });
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ HealthQ running on port " + PORT);
  console.log("🌐 Wikipedia + Groq LLaMA 3.1 8B ready!");
});
