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

test("makes fresh requests when the same result is validated again", async () => {
  let requestCount = 0;
  const client = new SefariaClient({
    fetchImpl: async (url) => {
      requestCount += 1;
      return url.includes("/api/ref/") ? jsonResponse(refPayload()) : jsonResponse(textPayload());
    }
  });

  await client.validateResult({ ref: "Genesis 1:1" });
  await client.validateResult({ ref: "Genesis 1:1" });
  assert.equal(requestCount, 4);
});

test("cleans encoded spacing and legacy markup from excerpts", () => {
  assert.equal(
    cleanText("<b>מִי</b>&nbsp;&#160;כָמֹכָה&thinsp;׀&ensp;טוֹב&emsp;מְאֹד&hairsp; &amp;"),
    "מִי  כָמֹכָה ׀ טוֹב מְאֹד  &"
  );
});
