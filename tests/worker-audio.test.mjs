import assert from "node:assert/strict";
import test from "node:test";

import { handleAudio, handleAudioLexicon } from "../worker/index.mjs";

class MemoryBucket {
  constructor() {
    this.objects = new Map();
  }
  async get(key) {
    return this.objects.get(key) || null;
  }
  async put(key, body, options = {}) {
    this.objects.set(key, {
      body,
      customMetadata: options.customMetadata || {},
      httpMetadata: options.httpMetadata || {}
    });
  }
  async delete(key) {
    this.objects.delete(key);
  }
}

function audioRequest(sourceType = "sefaria", text = "בָּרוּךְ", sourceRef = "Siddur Ashkenaz, Weekday, Shacharit") {
  const request = new Request("https://hebrewtransliterator.com/api/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://hebrewtransliterator.com" },
    body: JSON.stringify({
      schemaVersion: 2,
      sourceType,
      sourceRef: sourceType === "sefaria" ? sourceRef : "",
      text,
      tzere: "ei",
      lexicon: [{ grapheme: "בָּרוּךְ", phoneme: "ba.ˈʁux" }]
    })
  });
  Object.defineProperty(request, "cf", { value: { country: "US" } });
  return request;
}

function makeEnv() {
  const bucket = new MemoryBucket();
  const points = [];
  const azureBodies = [];
  let azureCalls = 0;
  return {
    bucket,
    points,
    azureBodies,
    get azureCalls() { return azureCalls; },
    env: {
      AUDIO_BUCKET: bucket,
      AZURE_SPEECH_KEY: "test-key",
      AZURE_SPEECH_REGION: "eastus",
      SPEECH_RATE_LIMITER: { async limit() { return { success: true }; } },
      USAGE: { writeDataPoint(point) { points.push(point); } },
      async AZURE_SPEECH_FETCH(_url, options) {
        azureCalls += 1;
        azureBodies.push(options.body);
        return new Response(new Uint8Array([73, 68, 51]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" }
        });
      }
    }
  };
}

test("uses fixed Hila settings, stores Sefaria audio, and reuses the cache", async () => {
  const state = makeEnv();
  const first = await handleAudio(audioRequest(), state.env);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("X-Audio-Cache"), "MISS");
  assert.match(state.azureBodies[0], /voice name="he-IL-HilaNeural"/);
  assert.match(state.azureBodies[0], /prosody rate="-60%"/);
  assert.match(state.azureBodies[0], /<lexicon uri="https:\/\/hebrewtransliterator\.com\/api\/audio\/lexicon\//);
  assert.equal(state.points[0].indexes[0], "audio_generated");
  assert.equal(state.points[0].blobs[17], "sefaria");
  assert.equal([...state.bucket.objects.keys()].some((key) => key.startsWith("lexicons/")), false);
  const debugLexicon = [...state.bucket.objects.entries()].find(([key]) => key.startsWith("debug/lexicons/"));
  const debugSsml = [...state.bucket.objects.entries()].find(([key]) => key.startsWith("debug/ssml/"));
  assert.ok(debugLexicon);
  assert.ok(debugSsml);
  assert.match(debugLexicon[1].body, /<grapheme>בָּרוּךְ<\/grapheme>/);
  assert.equal(debugLexicon[1].httpMetadata.contentType, "application/pls+xml; charset=utf-8");
  assert.equal(debugSsml[1].body, state.azureBodies[0]);
  assert.equal(debugSsml[1].customMetadata.sefariaReference, "Siddur Ashkenaz, Weekday, Shacharit");
  assert.equal(debugSsml[1].httpMetadata.contentType, "application/ssml+xml; charset=utf-8");
  const audioObject = [...state.bucket.objects.entries()].find(([key]) => key.startsWith("audio/"))[1];
  assert.equal(audioObject.customMetadata.sefariaReferences, "Siddur Ashkenaz, Weekday, Shacharit");

  const second = await handleAudio(audioRequest(), state.env);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("X-Audio-Cache"), "HIT");
  assert.equal(state.azureCalls, 1);
  assert.equal(state.points.length, 1);
});

test("adds another Sefaria reference to shared cached-audio metadata", async () => {
  const state = makeEnv();
  await handleAudio(audioRequest(), state.env);
  const result = await handleAudio(
    audioRequest("sefaria", "בָּרוּךְ", "Siddur Ashkenaz, Shabbat, Shacharit"),
    state.env
  );
  assert.equal(result.headers.get("X-Audio-Cache"), "HIT");
  const audioObject = [...state.bucket.objects.entries()].find(([key]) => key.startsWith("audio/"))[1];
  assert.equal(
    audioObject.customMetadata.sefariaReferences,
    "Siddur Ashkenaz, Weekday, Shacharit | Siddur Ashkenaz, Shabbat, Shacharit"
  );
  assert.equal(state.azureCalls, 1);
});

test("does not persist arbitrary Hebrew audio", async () => {
  const state = makeEnv();
  await handleAudio(audioRequest("arbitrary"), state.env);
  await handleAudio(audioRequest("arbitrary"), state.env);
  assert.equal(state.azureCalls, 2);
  assert.equal([...state.bucket.objects.keys()].some((key) => key.startsWith("audio/")), false);
  assert.equal([...state.bucket.objects.keys()].filter((key) => key.startsWith("debug/")).length, 2);
  const debugObjects = [...state.bucket.objects.entries()].filter(([key]) => key.startsWith("debug/"));
  assert.ok(debugObjects.every(([, object]) => object.customMetadata.sourceType === "arbitrary"));
  assert.ok(debugObjects.every(([, object]) => object.customMetadata.sefariaReference === ""));
  assert.deepEqual(state.points.map((point) => point.blobs[17]), ["arbitrary", "arbitrary"]);
});

test("omits non-Hebrew and unvocalized Hebrew from Azure SSML", async () => {
  const state = makeEnv();
  const result = await handleAudio(
    audioRequest("arbitrary", "English בָּרוּךְ שלום 42"),
    state.env
  );
  assert.equal(result.status, 200);
  assert.ok(state.azureBodies[0].includes("בָּרוּךְ".normalize("NFC")));
  assert.doesNotMatch(state.azureBodies[0], /English|שלום|42/u);

  const rejected = await handleAudio(audioRequest("arbitrary", "English שלום 42"), state.env);
  assert.equal(rejected.status, 400);
});

test("serves only a temporary unguessable lexicon object", async () => {
  const bucket = new MemoryBucket();
  const id = "123e4567-e89b-12d3-a456-426614174000";
  await bucket.put(`lexicons/${id}.xml`, "<lexicon/>");
  const result = await handleAudioLexicon(
    new Request(`https://hebrewtransliterator.com/api/audio/lexicon/${id}.xml`),
    { AUDIO_BUCKET: bucket },
    id
  );
  assert.equal(result.status, 200);
  assert.equal(await result.text(), "<lexicon/>");
});
