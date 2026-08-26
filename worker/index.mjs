const EVENT_SCHEMA_VERSION = 1;

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
    payload.schemaVersion !== EVENT_SCHEMA_VERSION ||
    !ALLOWED_EVENTS.has(payload.event)
  ) {
    console.warn(JSON.stringify({ category: "usage_event_rejected", reason: "schema" }));
    return response(400);
  }

  env.USAGE.writeDataPoint({
    indexes: [payload.event],
    blobs: [`schema-${EVENT_SCHEMA_VERSION}`],
    doubles: [1]
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
