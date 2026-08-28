const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SefariaClient,
  cleanText,
  textQuality
} = require("../site/sefaria-client");

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function refPayload(overrides = {}) {
  return {
    is_ref: true,
    normalized: "Genesis 1:1",
    hebrew: "בראשית א׳:א׳",
    url_ref: "Genesis.1.1",
    index_title: "Genesis",
    node_type: "JaggedArrayNode",
    navigation_refs: { first_available_section_ref: "Genesis 1:1" },
    depth: 2,
    start_indexes: [1, 1],
    ...overrides
  };
}

function textPayload(overrides = {}) {
  return {
    ref: "Genesis 1:1",
    heRef: "בראשית א׳:א׳",
    categories: ["Tanakh", "Torah"],
    versions: [{
      language: "he",
      versionTitle: "Miqra according to the Masorah",
      license: "CC-BY-SA",
      versionSource: "https://example.org/source",
      text: "בְּרֵאשִׁית בָּרָא אֱלֹהִים"
    }],
    ...overrides
  };
}

test("times out a Sefaria request", async () => {
  const client = new SefariaClient({
    timeoutMs: 5,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })
  });

  await assert.rejects(client.requestJson("https://www.sefaria.org/api/ref/Genesis"), {
    code: "timeout"
  });
});

test("honors caller cancellation", async () => {
  const parent = new AbortController();
  const client = new SefariaClient({
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })
  });

  const request = client.requestJson("https://www.sefaria.org/api/ref/Genesis", { signal: parent.signal });
  parent.abort();
  await assert.rejects(request, { code: "cancelled" });
});

test("validates an importable result and preserves Sefaria metadata", async () => {
  const requests = [];
  const client = new SefariaClient({
    fetchImpl: async (url) => {
      requests.push(url);
      return url.includes("/api/ref/") ? jsonResponse(refPayload()) : jsonResponse(textPayload());
    }
  });

  const result = await client.validateResult({ ref: "Genesis 1:1", source: "exact" });
  assert.equal(result.availability, "import");
  assert.equal(result.ref, "Genesis 1:1");
  assert.equal(result.heRef, "בראשית א׳:א׳");
  assert.deepEqual(result.categories, ["Tanakh", "Torah"]);
  assert.equal(result.versionTitle, "Miqra according to the Masorah");
  assert.equal(result.license, "CC-BY-SA");
  assert.equal(result.versionSource, "https://example.org/source");
  assert.match(result.sourceUrl, /Genesis\.1\.1$/);
  assert.match(result.excerpt, /בְּרֵאשִׁית/);
  assert.equal(requests.length, 2);
});

test("classifies a collection after verifying its first available section", async () => {
  const requests = [];
  const client = new SefariaClient({
    fetchImpl: async (url) => {
      requests.push(url);
      return url.includes("/api/ref/")
        ? jsonResponse(refPayload({
          normalized: "Siddur Ashkenaz",
          hebrew: "סידור אשכנז",
          url_ref: "Siddur_Ashkenaz",
          node_type: "SchemaNode",
          navigation_refs: {
            first_available_section_ref: "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers 1"
          },
          depth: null,
          start_indexes: []
        }))
        : jsonResponse(textPayload());
    }
  });

  const result = await client.validateResult({ ref: "Siddur Ashkenaz", source: "name" });
  assert.equal(result.availability, "browse");
  assert.equal(result.kind, "folder");
  assert.equal(result.quality.status, "vocalized");
  assert.equal(requests.length, 2);
});

test("rejects a collection whose available Hebrew is unvocalized", async () => {
  const client = new SefariaClient({
    fetchImpl: async (url) => url.includes("/api/ref/")
      ? jsonResponse(refPayload({
        normalized: "Siddur Rashi",
        hebrew: "סידור רש\"י",
        url_ref: "Siddur_Rashi",
        navigation_refs: { first_available_section_ref: "Siddur Rashi 1" },
        depth: 2,
        start_indexes: []
      }))
      : jsonResponse(textPayload({
        ref: "Siddur Rashi 1",
        versions: [{ language: "he", text: "תניא היה רבי מאיר אומר" }]
      }))
  });

  const result = await client.validateResult({ ref: "Siddur Rashi", source: "name" });
  assert.equal(result.valid, false);
  assert.equal(result.availability, "unavailable");
  assert.equal(result.quality.status, "unvocalized");
});

test("does not offer unvocalized Hebrew as directly importable", async () => {
  const client = new SefariaClient({
    fetchImpl: async (url) => url.includes("/api/ref/")
      ? jsonResponse(refPayload())
      : jsonResponse(textPayload({ versions: [{ language: "he", text: "בראשית ברא אלהים" }] }))
  });

  const result = await client.validateResult({ ref: "Genesis 1:1" });
  assert.equal(result.availability, "unavailable");
  assert.equal(result.quality.status, "unvocalized");
  assert.equal(textQuality("English only").status, "missing");
});

test("falls back to the legacy text API when Texts v3 fails", async () => {
  const requests = [];
  const client = new SefariaClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.includes("/api/ref/")) {
        return jsonResponse(refPayload());
      }
      if (url.includes("/api/v3/texts/")) {
        return jsonResponse({ error: "unavailable" }, 500);
      }
      return jsonResponse({
        ref: "Genesis 1:1",
        heRef: "בראשית א׳:א׳",
        he: "בְּרֵאשִׁית בָּרָא",
        heVersionTitle: "Legacy Hebrew",
        categories: ["Tanakh"]
      });
    }
  });

  const result = await client.validateResult({ ref: "Genesis 1:1" });
  assert.equal(result.availability, "import");
  assert.equal(result.versionTitle, "Legacy Hebrew");
  assert.equal(requests.length, 3);
});

test("does not retry a throttled Texts v3 request through the legacy API", async () => {
  const requests = [];
  const client = new SefariaClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.includes("/api/ref/")) {
        return jsonResponse(refPayload());
      }
      if (url.includes("/api/v3/texts/")) {
        return jsonResponse({ error: "too many requests" }, 429);
      }
      return jsonResponse({ he: "This fallback should not be requested." });
    }
  });

  await assert.rejects(client.validateResult({ ref: "Genesis 1:1" }), { status: 429 });
  assert.equal(requests.length, 2);
});

test("reuses successful responses during the page session", async () => {
  let requestCount = 0;
  const client = new SefariaClient({
    fetchImpl: async (url) => {
      requestCount += 1;
      return url.includes("/api/ref/") ? jsonResponse(refPayload()) : jsonResponse(textPayload());
    }
  });

  await client.validateResult({ ref: "Genesis 1:1" });
  await client.validateResult({ ref: "Genesis 1:1" });
  assert.equal(requestCount, 2);
});

test("expires cached responses after the configured lifetime", async () => {
  let requestCount = 0;
  let now = 1000;
  const client = new SefariaClient({
    cacheTtlMs: 100,
    now: () => now,
    fetchImpl: async () => {
      requestCount += 1;
      return jsonResponse({ requestCount });
    }
  });

  assert.equal((await client.requestJson("https://www.sefaria.org/api/test")).requestCount, 1);
  now += 50;
  assert.equal((await client.requestJson("https://www.sefaria.org/api/test")).requestCount, 1);
  now += 51;
  assert.equal((await client.requestJson("https://www.sefaria.org/api/test")).requestCount, 2);
});

test("can clear the page-session cache explicitly", async () => {
  let requestCount = 0;
  const client = new SefariaClient({
    fetchImpl: async () => jsonResponse({ requestCount: ++requestCount })
  });

  assert.equal((await client.requestJson("https://www.sefaria.org/api/test")).requestCount, 1);
  client.clearSessionCache();
  assert.equal((await client.requestJson("https://www.sefaria.org/api/test")).requestCount, 2);
});

test("deduplicates identical requests already in progress", async () => {
  let requestCount = 0;
  let resolveRequest;
  const client = new SefariaClient({
    fetchImpl: async () => {
      requestCount += 1;
      await new Promise((resolve) => { resolveRequest = resolve; });
      return jsonResponse({ ok: true });
    }
  });

  const first = client.requestJson("https://www.sefaria.org/api/test");
  const second = client.requestJson("https://www.sefaria.org/api/test");
  assert.equal(requestCount, 1);
  resolveRequest();
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await second, { ok: true });
});

test("does not cache errors", async () => {
  let requestCount = 0;
  const client = new SefariaClient({
    fetchImpl: async () => {
      requestCount += 1;
      return requestCount === 1
        ? jsonResponse({ error: true }, 503)
        : jsonResponse({ ok: true });
    }
  });

  await assert.rejects(client.requestJson("https://www.sefaria.org/api/test"), { status: 503 });
  assert.deepEqual(await client.requestJson("https://www.sefaria.org/api/test"), { ok: true });
  assert.equal(requestCount, 2);
});

test("reports slow requests and request errors", async () => {
  const slowEvents = [];
  const errorEvents = [];
  const slowClient = new SefariaClient({
    slowRequestMs: 5,
    timeoutMs: 50,
    onSlow: (event) => slowEvents.push(event),
    fetchImpl: async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse({ ok: true });
    }
  });
  await slowClient.requestJson("https://www.sefaria.org/api/slow");
  assert.equal(slowEvents.length, 1);

  const errorClient = new SefariaClient({
    onError: (error) => errorEvents.push(error),
    fetchImpl: async () => jsonResponse({ error: true }, 500)
  });
  await assert.rejects(errorClient.requestJson("https://www.sefaria.org/api/error"), { status: 500 });
  assert.equal(errorEvents.length, 1);
});

test("cleans encoded spacing and legacy markup from excerpts", () => {
  assert.equal(
    cleanText("<b>מִי</b>&nbsp;&#160;כָמֹכָה&thinsp;׀&ensp;טוֹב&emsp;מְאֹד&hairsp; &amp;"),
    "מִי  כָמֹכָה ׀ טוֹב מְאֹד  &"
  );
});

test("removes Masora circles from Sefaria text while preserving accent segol", () => {
  assert.equal(
    cleanText("בְּכָל֯־לְ֯בָבְ֒ךָ"),
    "בְּכָל־לְבָבְ֒ךָ"
  );
  assert.equal(cleanText("כָל&#x5AF;"), "כָל");
});
