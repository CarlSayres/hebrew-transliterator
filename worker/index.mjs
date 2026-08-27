const EVENT_SCHEMA_VERSION = 2;
const SUPPORTED_CLIENT_SCHEMA_VERSIONS = new Set([1, 2]);

const ALLOWED_EVENTS = new Set([
  "transliteration_copied",
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
    console.error(JSON.stringify({ category: "feedback_failed", reason: "configuration" }));
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
  if (
    keys.length !== 2 ||
    keys[0] !== "event" ||
    keys[1] !== "schemaVersion" ||
    !SUPPORTED_CLIENT_SCHEMA_VERSIONS.has(payload.schemaVersion) ||
    !ALLOWED_EVENTS.has(payload.event)
  ) {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "schema" }));
    return response(400);
  }

  const url = new URL(request.url);
  const cf = request.cf || {};
  const version = env.CF_VERSION_METADATA || {};
  const hasCoordinates = cf.latitude !== null && cf.latitude !== undefined &&
    cf.longitude !== null && cf.longitude !== undefined;

  env.USAGE.writeDataPoint({
    indexes: [payload.event],
    blobs: [
      `schema-${EVENT_SCHEMA_VERSION}`,
      `client-schema-${payload.schemaVersion}`,
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
      hasCoordinates ? "1" : "0"
    ],
    doubles: [
      1,
      numericDimension(cf.latitude),
      numericDimension(cf.longitude)
    ]
  });

  return response(204);
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
    if (url.pathname.startsWith("/api/")) {
      return response(404);
    }
    return env.ASSETS.fetch(request);
  }
};
