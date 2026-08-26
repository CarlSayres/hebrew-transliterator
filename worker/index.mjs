const EVENT_SCHEMA_VERSION = 2;
const SUPPORTED_CLIENT_SCHEMA_VERSIONS = new Set([1, 2]);

const ALLOWED_EVENTS = new Set([
  "transliteration_copied",
  "sefaria_search_succeeded",
  "sefaria_search_zero_results",
  "sefaria_search_failed",
  "sefaria_import_succeeded",
  "sefaria_import_failed",
  "style_selected"
]);

const ALLOWED_ORIGINS = new Set([
  "https://hebrewtransliterator.com",
  "https://www.hebrewtransliterator.com",
  "https://hebrew-transliterator.carl-6b2.workers.dev"
]);

function response(status, headers = {}) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
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
    if (url.pathname.startsWith("/api/")) {
      return response(404);
    }
    return env.ASSETS.fetch(request);
  }
};
