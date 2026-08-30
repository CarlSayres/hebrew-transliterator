const EVENT_SCHEMA_VERSION = 3;
const SUPPORTED_CLIENT_SCHEMA_VERSIONS = new Set([1, 2, 3]);

const ALLOWED_EVENTS = new Set([
  "transliteration_copied",
  "hebrew_copied",
  "speech_started",
  "audio_listened",
  "audio_downloaded",
  "audio_generated",
  "sefaria_search_succeeded",
  "sefaria_search_zero_results",
  "sefaria_search_failed",
  "sefaria_import_succeeded",
  "sefaria_import_failed",
  "feedback_sent",
  "style_selected"
]);

const ALLOWED_ORIGINS = new Set([
  "https://hebrewtransliterator.com",
  "https://www.hebrewtransliterator.com",
  "https://hebrew-transliterator.carl-6b2.workers.dev",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://localhost:8787"
]);

const FEEDBACK_TYPES = new Set(["problem", "suggestion", "other"]);
const FEEDBACK_SENDER = "Hebrew Transliterator <feedback@mail.hebrewtransliterator.com>";
const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const AUDIO_SOURCE_TYPES = new Set(["sefaria", "arbitrary"]);
const AUDIO_VOICE = "he-IL-HilaNeural";
const AUDIO_RATE = "-60%";
const AUDIO_RULES_VERSION = "ipa-v1";
const AZURE_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const MAX_AUDIO_TEXT_LENGTH = 8000;
const MAX_AUDIO_BODY_LENGTH = 120000;

function response(status, headers = {}) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function feedbackResponse(status) {
  return response(status, { "Content-Type": "application/json; charset=utf-8" });
}

function cleanFeedbackText(value, maxLength) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function validFeedbackContext(value) {
  if (value === null) {
    return true;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  return keys.length === 4 &&
    keys[0] === "query" &&
    keys[1] === "ref" &&
    keys[2] === "text" &&
    keys[3] === "versionTitle" &&
    typeof value.query === "string" && value.query.length <= 100 &&
    typeof value.ref === "string" && value.ref.length <= 300 &&
    typeof value.versionTitle === "string" && value.versionTitle.length <= 300 &&
    typeof value.text === "string" && value.text.length <= 20000;
}

function feedbackEmailText(payload, request) {
  const context = payload.context;
  const lines = [
    `Type: ${payload.type}`,
    `Submitted: ${new Date().toISOString()}`,
    `Country: ${cleanFeedbackText(request.cf?.country, 8) || "Unknown"}`,
    "",
    "Message:",
    payload.message
  ];
  if (context) {
    lines.push(
      "",
      "Sefaria context:",
      `Search: ${context.query || "None"}`,
      `Reference: ${context.ref || "None"}`,
      `Edition: ${context.versionTitle || "None"}`
    );
    if (context.text) {
      lines.push("", "Imported Hebrew text:", context.text);
    }
  }
  return lines.join("\n");
}

export async function handleFeedback(request, env) {
  if (request.method !== "POST") {
    return response(405, { Allow: "POST" });
  }

  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    console.warn(JSON.stringify({ category: "feedback_rejected", reason: "origin" }));
    return feedbackResponse(403);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 26000) {
    console.warn(JSON.stringify({ category: "feedback_rejected", reason: "size" }));
    return feedbackResponse(413);
  }

  let rawPayload;
  try {
    rawPayload = await request.text();
  } catch {
    return feedbackResponse(400);
  }
  if (rawPayload.length > 26000) {
    return feedbackResponse(413);
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return feedbackResponse(400);
  }

  const keys = Object.keys(payload || {}).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== "context" ||
    keys[1] !== "message" ||
    keys[2] !== "type" ||
    keys[3] !== "website" ||
    !FEEDBACK_TYPES.has(payload.type) ||
    typeof payload.message !== "string" ||
    payload.message.trim().length < 1 ||
    payload.message.length > 4000 ||
    typeof payload.website !== "string" ||
    payload.website.length > 200 ||
    !validFeedbackContext(payload.context)
  ) {
    console.warn(JSON.stringify({ category: "feedback_rejected", reason: "schema" }));
    return feedbackResponse(400);
  }

  if (payload.website) {
    return feedbackResponse(204);
  }

  if (!env.FEEDBACK_RATE_LIMITER || !env.RESEND_API_KEY || !env.FEEDBACK_RECIPIENT) {
    const missing = [
      !env.FEEDBACK_RATE_LIMITER && "FEEDBACK_RATE_LIMITER",
      !env.RESEND_API_KEY && "RESEND_API_KEY",
      !env.FEEDBACK_RECIPIENT && "FEEDBACK_RECIPIENT",
    ].filter(Boolean);
    console.error(JSON.stringify({ category: "feedback_failed", reason: "configuration", missing }));
    return feedbackResponse(503);
  }

  const rateKey = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateResult = await env.FEEDBACK_RATE_LIMITER.limit({ key: rateKey });
  if (!rateResult.success) {
    console.warn(JSON.stringify({ category: "feedback_rejected", reason: "rate" }));
    return feedbackResponse(429);
  }

  const cleanPayload = {
    type: payload.type,
    message: cleanFeedbackText(payload.message, 4000),
    context: payload.context && {
      query: cleanFeedbackText(payload.context.query, 100),
      ref: cleanFeedbackText(payload.context.ref, 300),
      versionTitle: cleanFeedbackText(payload.context.versionTitle, 300),
      text: cleanFeedbackText(payload.context.text, 20000)
    }
  };

  try {
    const sendFetch = env.RESEND_FETCH || fetch;
    const emailResponse = await sendFetch(RESEND_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        to: [env.FEEDBACK_RECIPIENT],
        from: FEEDBACK_SENDER,
        subject: `[Hebrew Transliterator] ${cleanPayload.type[0].toUpperCase()}${cleanPayload.type.slice(1)}`,
        text: feedbackEmailText(cleanPayload, request)
      })
    });
    if (!emailResponse.ok) {
      const resendError = new Error("Resend rejected the email request.");
      resendError.code = `resend_${emailResponse.status}`;
      throw resendError;
    }
  } catch (error) {
    console.error(JSON.stringify({
      category: "feedback_failed",
      reason: "email",
      code: cleanFeedbackText(error?.code, 80)
    }));
    return feedbackResponse(502);
  }

  return feedbackResponse(204);
}

function textDimension(value, maxLength = 128) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).slice(0, maxLength);
}

function numericDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function writeUsagePoint(event, sourceType, request, env, clientSchemaVersion = EVENT_SCHEMA_VERSION) {
  const url = new URL(request.url);
  const cf = request.cf || {};
  const version = env.CF_VERSION_METADATA || {};
  const hasCoordinates = cf.latitude !== null && cf.latitude !== undefined &&
    cf.longitude !== null && cf.longitude !== undefined;

  env.USAGE?.writeDataPoint({
    indexes: [event],
    blobs: [
      `schema-${EVENT_SCHEMA_VERSION}`,
      `client-schema-${clientSchemaVersion}`,
      textDimension(version.id, 64),
      textDimension(version.tag, 64),
      textDimension(version.timestamp, 64),
      textDimension(url.hostname, 253),
      textDimension(cf.continent, 8),
      textDimension(cf.country, 8),
      textDimension(cf.region),
      textDimension(cf.regionCode, 16),
      textDimension(cf.city),
      textDimension(cf.postalCode, 32),
      textDimension(cf.metroCode, 32),
      textDimension(cf.timezone, 64),
      cf.isEUCountry === "1" ? "1" : "0",
      textDimension(cf.colo, 8),
      hasCoordinates ? "1" : "0",
      AUDIO_SOURCE_TYPES.has(sourceType) ? sourceType : ""
    ],
    doubles: [
      1,
      numericDimension(cf.latitude),
      numericDimension(cf.longitude)
    ]
  });
}

export async function handleEvent(request, env) {
  if (request.method !== "POST") {
    return response(405, { Allow: "POST" });
  }

  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "origin" }));
    return response(403);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 512) {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "size" }));
    return response(413);
  }

  let rawPayload;
  try {
    rawPayload = await request.text();
  } catch {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "json" }));
    return response(400);
  }

  if (rawPayload.length > 512) {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "size" }));
    return response(413);
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "json" }));
    return response(400);
  }

  const keys = Object.keys(payload || {}).sort();
  const isAudioAction = ["audio_listened", "audio_downloaded"].includes(payload?.event);
  const validKeys = isAudioAction
    ? keys.length === 3 && keys[0] === "event" && keys[1] === "schemaVersion" && keys[2] === "sourceType"
    : keys.length === 2 && keys[0] === "event" && keys[1] === "schemaVersion";
  if (
    !validKeys ||
    !SUPPORTED_CLIENT_SCHEMA_VERSIONS.has(payload.schemaVersion) ||
    !ALLOWED_EVENTS.has(payload.event) ||
    payload.event === "audio_generated" ||
    (isAudioAction && (payload.schemaVersion !== 3 || !AUDIO_SOURCE_TYPES.has(payload.sourceType)))
  ) {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "schema" }));
    return response(400);
  }

  writeUsagePoint(payload.event, payload.sourceType, request, env, payload.schemaVersion);

  return response(204);
}

function canonicalAudioText(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[ \t]*\{\s*[פס]\s*\}[ \t]*/gu, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

function speakableAudioText(value, lexicon) {
  const recognizedWords = new Set(
    Array.from(lexicon || [], (entry) => String(entry?.grapheme || "").normalize("NFC")).filter(Boolean)
  );
  const tokens = canonicalAudioText(value)
    .replace(/־/gu, " ")
    .match(/[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*|[.,!?;:׃–—…]+/gu) || [];
  let result = "";
  for (const token of tokens) {
    if (/^[\u05d0-\u05ea]/u.test(token)) {
      if (!/[\u05b0-\u05bb\u05c7]/u.test(token) && !recognizedWords.has(token.normalize("NFC"))) continue;
      result += `${result && !result.endsWith(" ") ? " " : ""}${token}`;
    } else if (result) {
      result = `${result.trimEnd()}${token} `;
    }
  }
  return result.trim();
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validLexicon(entries, text) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 1000) {
    return false;
  }
  const textWords = new Set(
    text.match(/[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*/gu) || []
  );
  return entries.every((entry) => {
    const keys = Object.keys(entry || {}).sort();
    return keys.length === 2 && keys[0] === "grapheme" && keys[1] === "phoneme" &&
      typeof entry.grapheme === "string" && entry.grapheme.length <= 100 &&
      typeof entry.phoneme === "string" && entry.phoneme.length <= 240 &&
      textWords.has(entry.grapheme.normalize("NFC")) &&
      /^[a-z.ˈˌʔʃxʁ͡\u0361\-]+$/iu.test(entry.phoneme);
  });
}

function buildLexicon(entries) {
  const lexemes = entries.map((entry) =>
    `  <lexeme><grapheme>${xmlEscape(entry.grapheme)}</grapheme><phoneme>${xmlEscape(entry.phoneme)}</phoneme></lexeme>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.w3.org/2005/01/pronunciation-lexicon http://www.w3.org/TR/2007/CR-pronunciation-lexicon-20071212/pls.xsd" alphabet="ipa" xml:lang="he-IL">\n${lexemes}\n</lexicon>`;
}

function speechSentences(text, maximumLength = 500) {
  const pieces = text.match(/[^.!?;:׃]+[.!?;:׃]?/gu) || [text];
  const sentences = [];
  let current = "";
  for (const piece of pieces) {
    const words = piece.trim().split(/\s+/u).filter(Boolean);
    for (const word of words) {
      if (current && `${current} ${word}`.length > maximumLength) {
        sentences.push(current);
        current = "";
      }
      current = current ? `${current} ${word}` : word;
    }
    if (current && /[.!?;:׃]$/u.test(piece.trim())) {
      sentences.push(current);
      current = "";
    }
  }
  if (current) sentences.push(current);
  return sentences;
}

function buildSsml(text, lexiconUrl) {
  const sentences = speechSentences(text)
    .map((sentence) => `      <s>${xmlEscape(sentence)}</s>`)
    .join("\n");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="he-IL">\n  <voice name="${AUDIO_VOICE}">\n    <lexicon uri="${xmlEscape(lexiconUrl)}"/>\n    <mstts:silence type="Sentenceboundary-exact" value="140ms"/>\n    <prosody rate="${AUDIO_RATE}">\n${sentences}\n    </prosody>\n  </voice>\n</speak>`;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function audioCacheKey(text, tzere) {
  const identity = JSON.stringify({
    text,
    voice: AUDIO_VOICE,
    rate: AUDIO_RATE,
    tzere,
    rules: AUDIO_RULES_VERSION,
    format: AZURE_OUTPUT_FORMAT
  });
  return `audio/${await sha256Hex(identity)}.mp3`;
}

function audioDebugKeys(cacheKey) {
  const hash = cacheKey.slice("audio/".length, -".mp3".length);
  return {
    lexicon: `debug/lexicons/${hash}.xml`,
    ssml: `debug/ssml/${hash}.ssml`
  };
}

async function storeAudioDebugArtifacts(env, cacheKey, lexicon, ssml, payload, sourceRef) {
  const keys = audioDebugKeys(cacheKey);
  const commonMetadata = {
    audioKey: cacheKey,
    sourceType: payload.sourceType,
    sefariaReference: sourceRef,
    rules: AUDIO_RULES_VERSION,
    voice: AUDIO_VOICE,
    rate: AUDIO_RATE,
    tzere: payload.tzere,
    createdAt: new Date().toISOString()
  };
  await Promise.all([
    env.AUDIO_BUCKET.put(keys.lexicon, lexicon, {
      httpMetadata: { contentType: "application/pls+xml; charset=utf-8" },
      customMetadata: { ...commonMetadata, artifact: "lexicon" }
    }),
    env.AUDIO_BUCKET.put(keys.ssml, ssml, {
      httpMetadata: { contentType: "application/ssml+xml; charset=utf-8" },
      customMetadata: { ...commonMetadata, artifact: "ssml" }
    })
  ]);
}

function audioResponse(body, cacheStatus) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": cacheStatus === "HIT" ? "private, max-age=3600" : "no-store",
      "X-Audio-Cache": cacheStatus
    }
  });
}

function cleanSefariaReference(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\0\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function mergedSefariaReferences(existing, current) {
  const references = String(existing || "")
    .split(" | ")
    .map((value) => value.trim())
    .filter(Boolean);
  if (current && !references.includes(current)) references.push(current);
  while (references.join(" | ").length > 1000) references.shift();
  return references.join(" | ");
}

export async function handleAudioLexicon(request, env, id) {
  if (request.method !== "GET" || !/^[0-9a-f-]{36}$/i.test(id || "") || !env.AUDIO_BUCKET) {
    return response(404);
  }
  const object = await env.AUDIO_BUCKET.get(`lexicons/${id}.xml`);
  if (!object) return response(404);
  return new Response(object.body, {
    headers: { "Content-Type": "application/pls+xml; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function handleAudio(request, env) {
  if (request.method !== "POST") return response(405, { Allow: "POST" });
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response(403);
  if (!env.AUDIO_BUCKET || !env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) return response(503);
  if (!/^[a-z0-9-]+$/i.test(env.AZURE_SPEECH_REGION)) return response(503);

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_AUDIO_BODY_LENGTH) return response(413);
  let raw;
  try {
    raw = await request.text();
  } catch {
    return response(400);
  }
  if (raw.length > MAX_AUDIO_BODY_LENGTH) return response(413);
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return response(400);
  }
  const keys = Object.keys(payload || {}).sort();
  const isLegacyPayload = payload?.schemaVersion === 1 &&
    keys.length === 5 && keys[0] === "lexicon" && keys[1] === "schemaVersion" &&
    keys[2] === "sourceType" && keys[3] === "text" && keys[4] === "tzere";
  const isCurrentPayload = payload?.schemaVersion === 2 &&
    keys.length === 6 && keys[0] === "lexicon" && keys[1] === "schemaVersion" &&
    keys[2] === "sourceRef" && keys[3] === "sourceType" && keys[4] === "text" && keys[5] === "tzere";
  const text = speakableAudioText(payload?.text, payload?.lexicon);
  const sourceRef = cleanSefariaReference(payload?.sourceRef);
  if (
    (!isLegacyPayload && !isCurrentPayload) || !["e", "ei"].includes(payload.tzere) ||
    !AUDIO_SOURCE_TYPES.has(payload.sourceType) || !text || text.length > MAX_AUDIO_TEXT_LENGTH ||
    !/[\u05d0-\u05ea]/u.test(text) || !validLexicon(payload.lexicon, text) ||
    (isCurrentPayload && ((payload.sourceType === "sefaria" && !sourceRef) || (payload.sourceType === "arbitrary" && sourceRef)))
  ) return response(400);

  const cacheKey = await audioCacheKey(text, payload.tzere);
  if (payload.sourceType === "sefaria") {
    const cached = await env.AUDIO_BUCKET.get(cacheKey);
    if (cached) {
      const references = mergedSefariaReferences(cached.customMetadata?.sefariaReferences, sourceRef);
      if (sourceRef && references !== cached.customMetadata?.sefariaReferences) {
        const audio = await new Response(cached.body).arrayBuffer();
        await env.AUDIO_BUCKET.put(cacheKey, audio, {
          httpMetadata: { contentType: "audio/mpeg" },
          customMetadata: { ...(cached.customMetadata || {}), sefariaReferences: references }
        });
        return audioResponse(audio, "HIT");
      }
      return audioResponse(cached.body, "HIT");
    }
  }

  if (!env.SPEECH_RATE_LIMITER) return response(503);
  const rateKey = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateResult = await env.SPEECH_RATE_LIMITER.limit({ key: rateKey });
  if (!rateResult.success) return response(429);

  const lexiconId = crypto.randomUUID();
  const lexiconKey = `lexicons/${lexiconId}.xml`;
  const lexiconUrl = `${new URL(request.url).origin}/api/audio/lexicon/${lexiconId}.xml`;
  const lexicon = buildLexicon(payload.lexicon);
  const ssml = buildSsml(text, lexiconUrl);
  await env.AUDIO_BUCKET.put(lexiconKey, lexicon, {
    httpMetadata: { contentType: "application/pls+xml; charset=utf-8" }
  });
  try {
    await storeAudioDebugArtifacts(env, cacheKey, lexicon, ssml, payload, sourceRef);
  } catch {
    console.error(JSON.stringify({ category: "audio_debug_artifact_failed", reason: "write" }));
  }

  try {
    const azureFetch = env.AZURE_SPEECH_FETCH || fetch;
    const azureResponse = await azureFetch(
      `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": AZURE_OUTPUT_FORMAT,
          "User-Agent": "HebrewTransliterator"
        },
        body: ssml
      }
    );
    if (!azureResponse.ok) {
      console.error(JSON.stringify({ category: "audio_failed", status: azureResponse.status }));
      return response(502);
    }
    const audio = await azureResponse.arrayBuffer();
    if (!audio.byteLength) return response(502);
    writeUsagePoint("audio_generated", payload.sourceType, request, env);
    if (payload.sourceType === "sefaria") {
      try {
        await env.AUDIO_BUCKET.put(cacheKey, audio, {
          httpMetadata: { contentType: "audio/mpeg" },
          customMetadata: {
            rules: AUDIO_RULES_VERSION,
            voice: AUDIO_VOICE,
            rate: AUDIO_RATE,
            tzere: payload.tzere,
            sefariaReferences: sourceRef
          }
        });
      } catch {
        console.error(JSON.stringify({ category: "audio_cache_failed", reason: "write" }));
      }
    }
    return audioResponse(audio, "MISS");
  } catch (error) {
    console.error(JSON.stringify({ category: "audio_failed", reason: textDimension(error?.name, 40) }));
    return response(502);
  } finally {
    try {
      await env.AUDIO_BUCKET.delete(lexiconKey);
    } catch {
      console.error(JSON.stringify({ category: "audio_lexicon_cleanup_failed" }));
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/event") {
      return handleEvent(request, env);
    }
    if (url.pathname === "/api/feedback") {
      return handleFeedback(request, env);
    }
    if (url.pathname === "/api/audio") {
      return handleAudio(request, env);
    }
    const lexiconMatch = url.pathname.match(/^\/api\/audio\/lexicon\/([0-9a-f-]{36})\.xml$/i);
    if (lexiconMatch) {
      return handleAudioLexicon(request, env, lexiconMatch[1]);
    }
    if (url.pathname.startsWith("/api/")) {
      return response(404);
    }
    return env.ASSETS.fetch(request);
  }
};
