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
    const error = new Error("Google sign-in is required before using Gemini.");
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
    const error = new Error("This Google account is not authorised to use the Gemini proxy.");
    error.status = 403;
    throw error;
  }

  return decoded;
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
                  text: "You are JARVIS, a rigorous UPSC Civil Services Examination assistant. Follow requested formats exactly. Be factual and source-conscious. Never invent data, reports, judgments, constitutional provisions, schemes or PYQs."
                }
              ]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: rawPrompt }]
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
