import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const OWNER_EMAIL = defineSecret("OWNER_EMAIL");

const ALLOWED_MODELS = new Set([
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
]);

// Feed URLs are fixed server-side. The browser cannot ask this function to fetch
// arbitrary URLs, which prevents SSRF while still making the daily CA workflow easy.
const NEWS_FEEDS = Object.freeze({
  "hindu-national": {
    name: "The Hindu — National",
    category: "Newspaper",
    url: "https://www.thehindu.com/news/national/feeder/default.rss",
    homepage: "https://www.thehindu.com/news/national/"
  },
  "hindu-editorial": {
    name: "The Hindu — Editorial",
    category: "Editorial",
    url: "https://www.thehindu.com/opinion/editorial/feeder/default.rss",
    homepage: "https://www.thehindu.com/opinion/editorial/"
  },
  "ie-explained": {
    name: "Indian Express — Explained",
    category: "Explainer",
    url: "https://indianexpress.com/section/explained/feed/",
    homepage: "https://indianexpress.com/section/explained/"
  },
  "ie-editorials": {
    name: "Indian Express — Editorials",
    category: "Editorial",
    url: "https://indianexpress.com/section/opinion/editorials/feed/",
    homepage: "https://indianexpress.com/section/opinion/editorials/"
  },
  "ie-economy": {
    name: "Indian Express — Economy",
    category: "Economy",
    url: "https://indianexpress.com/section/business/economy/feed/",
    homepage: "https://indianexpress.com/section/business/economy/"
  },
  "ie-climate": {
    name: "Indian Express — Climate",
    category: "Environment",
    url: "https://indianexpress.com/section/explained/explained-climate/feed/",
    homepage: "https://indianexpress.com/section/explained/explained-climate/"
  },
  "ie-scitech": {
    name: "Indian Express — Science & Tech",
    category: "Science & Tech",
    url: "https://indianexpress.com/section/explained/explained-sci-tech/feed/",
    homepage: "https://indianexpress.com/section/explained/explained-sci-tech/"
  },
  "pib-releases": {
    name: "PIB — Press Releases",
    category: "Government",
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    homepage: "https://www.pib.gov.in/"
  },
  "rbi-press": {
    name: "RBI — Press Releases",
    category: "Economy",
    url: "https://www.rbi.org.in/pressreleases_rss.xml",
    homepage: "https://www.rbi.org.in/Scripts/BS_PressreleaseDisplay.aspx"
  },
  "rbi-notifications": {
    name: "RBI — Notifications",
    category: "Economy",
    url: "https://www.rbi.org.in/notifications_rss.xml",
    homepage: "https://www.rbi.org.in/Scripts/NotificationUser.aspx"
  },
  "niti-updates": {
    name: "NITI Aayog — Updates",
    category: "Reports",
    url: "https://www.niti.gov.in/rss.xml",
    homepage: "https://www.niti.gov.in/whats-new"
  }
});

function buildLegacyPrompt(type, payload = {}, stats = {}) {
  if (type === "newspaper") {
    return `Analyze this article for UPSC. Give GS paper, syllabus link, prelims facts, mains dimensions, keywords, a possible MCQ, a possible mains question, and a concise revision summary. Do not fabricate facts or sources.\n\nArticle:\n${payload.text || payload.article || ""}`;
  }
  if (type === "notes") {
    return `Create UPSC-ready notes with an introduction, core concepts, prelims facts, mains dimensions, PYQ angle, examples, flashcards, MCQs, and a revision checklist. Do not fabricate sources.\n\nTopic: ${payload.topic || ""}\n\nContent:\n${payload.text || ""}`;
  }
  if (type === "mentor") {
    return `Act as a strict but supportive UPSC mentor. Diagnose the preparation evidence and give a measurable seven-day plan.\n\nStats:\n${JSON.stringify(stats || {})}\n\nQuestion:\n${payload.question || ""}`;
  }
  return payload.question || payload.prompt || JSON.stringify(payload || {});
}

async function verifyOwner(req) {
  const authHeader = String(req.headers.authorization || "");
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Google sign-in is required before using JARVIS cloud tools.");
    error.status = 401;
    throw error;
  }

  const decoded = await getAuth().verifyIdToken(match[1]);
  const allowedEmail = String(OWNER_EMAIL.value() || "").trim().toLowerCase();
  const signedInEmail = String(decoded.email || "").trim().toLowerCase();

  if (!allowedEmail) {
    const error = new Error("OWNER_EMAIL secret is not configured.");
    error.status = 500;
    throw error;
  }
  if (!decoded.email_verified || signedInEmail !== allowedEmail) {
    const error = new Error("This Google account is not authorised to use the JARVIS backend.");
    error.status = 403;
    throw error;
  }

  return decoded;
}

function decodeEntities(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cleanText(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(block, names) {
  for (const name of names) {
    const safe = name.replace(":", "\\:");
    const match = block.match(new RegExp(`<${safe}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safe}>`, "i"));
    if (match) return match[1];
  }
  return "";
}

function extractLink(block) {
  const raw = firstTag(block, ["link", "guid"]);
  if (raw && /^https?:\/\//i.test(cleanText(raw))) return cleanText(raw);
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?\s*>/i);
  return href ? decodeEntities(href[1]).trim() : cleanText(raw);
}

function toIsoDate(value = "") {
  const d = new Date(cleanText(value));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function parseFeed(xml, feedId, feed) {
  const blocks = [
    ...(String(xml).match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []),
    ...(String(xml).match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [])
  ];
  const base = new URL(feed.homepage || feed.url);
  return blocks.slice(0, 40).map((block, index) => {
    const title = cleanText(firstTag(block, ["title"]));
    let link = extractLink(block);
    try { link = new URL(link || feed.homepage, base).href; } catch { link = feed.homepage; }
    const description = cleanText(firstTag(block, ["description", "summary", "content:encoded", "content"]));
    const publishedAt = toIsoDate(firstTag(block, ["pubDate", "published", "updated", "dc:date"]));
    return {
      id: `${feedId}-${index}-${Buffer.from(title).toString("base64url").slice(0, 16)}`,
      feedId,
      source: feed.name,
      category: feed.category,
      title,
      url: link,
      excerpt: description.slice(0, 1400),
      publishedAt,
      homepage: feed.homepage
    };
  }).filter(item => item.title && item.url);
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mission-UPSC-JARVIS/30.6 (personal RSS reader)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 3_000_000) throw new Error("Feed response was too large");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDailySources(body) {
  const requested = Array.isArray(body.feedIds) && body.feedIds.length
    ? body.feedIds.map(String).filter(id => NEWS_FEEDS[id])
    : Object.keys(NEWS_FEEDS);
  const perFeed = Math.max(3, Math.min(20, Number(body.perFeed || 10)));
  const settled = await Promise.allSettled(requested.map(async feedId => {
    const feed = NEWS_FEEDS[feedId];
    const xml = await fetchText(feed.url);
    return { feedId, feed, items: parseFeed(xml, feedId, feed).slice(0, perFeed) };
  }));

  const statuses = [];
  const items = [];
  settled.forEach((result, index) => {
    const feedId = requested[index];
    const feed = NEWS_FEEDS[feedId];
    if (result.status === "fulfilled") {
      items.push(...result.value.items);
      statuses.push({ feedId, source: feed.name, ok: true, count: result.value.items.length });
    } else {
      statuses.push({ feedId, source: feed.name, ok: false, count: 0, error: result.reason?.message || String(result.reason) });
    }
  });

  const seen = new Set();
  const unique = items.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

  return {
    fetchedAt: new Date().toISOString(),
    items: unique.slice(0, 120),
    statuses,
    feeds: requested.map(id => ({ id, ...NEWS_FEEDS[id] }))
  };
}

export const upscAI = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY, OWNER_EMAIL],
    timeoutSeconds: 300,
    memory: "512MiB",
    maxInstances: 2
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST." });
      return;
    }

    try {
      const owner = await verifyOwner(req);
      const body = req.body || {};

      // Free source collection: this branch never calls Gemini and therefore
      // does not consume model tokens. The user still controls the later
      // Generate button in the frontend.
      if (body.action === "fetchDailySources") {
        const result = await fetchDailySources(body);
        res.json({ ...result, provider: "rss", tokenUsage: 0, uid: owner.uid });
        return;
      }

      const rawPrompt = String(
        body.prompt || buildLegacyPrompt(body.type, body.payload, body.stats)
      ).trim();

      if (!rawPrompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
      }
      if (rawPrompt.length > 250000) {
        res.status(413).json({ error: "Prompt is too large for this endpoint." });
        return;
      }

      const requestedModel = String(body.model || "gemini-2.5-flash").trim();
      const model = ALLOWED_MODELS.has(requestedModel)
        ? requestedModel
        : "gemini-2.5-flash";
      const temperature = Math.max(0, Math.min(1, Number(body.temperature ?? 0.2)));
      const maxOutputTokens = Math.max(
        512,
        Math.min(65536, Number(body.maxOutputTokens ?? 8192))
      );

      const parts = [{ text: rawPrompt }];
      const uploadedFile = body.file && typeof body.file === "object" ? body.file : null;
      if (uploadedFile) {
        const mimeType = String(uploadedFile.mimeType || "application/octet-stream").trim();
        const dataBase64 = String(uploadedFile.dataBase64 || "").replace(/^data:[^,]+,/, "").trim();
        if (!dataBase64) {
          res.status(400).json({ error: "Uploaded file data is empty." });
          return;
        }
        if (dataBase64.length > 17_000_000) {
          res.status(413).json({ error: "Uploaded file is too large. Compress it below about 12 MB." });
          return;
        }
        if (!/^(image\/|application\/pdf$)/i.test(mimeType)) {
          res.status(415).json({ error: "Secure visual reading supports images and PDF files only." });
          return;
        }
        parts.push({ inline_data: { mime_type: mimeType, data: dataBase64 } });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY.value()
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text: "You are JARVIS, a rigorous UPSC Civil Services Examination assistant. Follow requested formats exactly. Be factual and source-conscious. Never invent data, reports, judgments, constitutional provisions, schemes or PYQs. When a file is attached, read only what is visible and clearly separate extraction from interpretation."
                }
              ]
            },
            contents: [
              {
                role: "user",
                parts
              }
            ],
            generationConfig: {
              temperature,
              maxOutputTokens
            }
          })
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.status(response.status).json({
          error: data?.error?.message || `Gemini request failed with HTTP ${response.status}`,
          model
        });
        return;
      }

      const result = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("\n")
        .trim();

      if (!result) {
        res.status(502).json({
          error:
            data?.promptFeedback?.blockReason ||
            data?.candidates?.[0]?.finishReason ||
            "Gemini returned no text.",
          model
        });
        return;
      }

      res.json({ result, model, provider: "gemini", uid: owner.uid });
    } catch (error) {
      const status = Number(error?.status) || (String(error?.code || "").startsWith("auth/") ? 401 : 500);
      res.status(status).json({ error: error?.message || String(error) });
    }
  }
);
