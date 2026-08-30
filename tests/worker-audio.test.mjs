import assert from "node:assert/strict";
import test from "node:test";

import { handleAudio, handleAudioLexicon } from "../worker/index.mjs";

class MemoryBucket {
  constructor() {
    this.objects = new Map();
  }
  async get(key) {
    return this.objects.has(key) ? { body: this.objects.get(key) } : null;
  }
  async put(key, body) {
    this.objects.set(key, body);
  }
  async delete(key) {
    this.objects.delete(key);
  }
}

function audioRequest(sourceType = "sefaria", text = "בָּרוּךְ") {
  const request = new Request("https://hebrewtransliterator.com/api/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://hebrewtransliterator.com" },
    body: JSON.stringify({
      schemaVersion: 1,
      sourceType,
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

  const second = await handleAudio(audioRequest(), state.env);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("X-Audio-Cache"), "HIT");
  assert.equal(state.azureCalls, 1);
  assert.equal(state.points.length, 1);
});

test("does not persist arbitrary Hebrew audio", async () => {
  const state = makeEnv();
  await handleAudio(audioRequest("arbitrary"), state.env);
  await handleAudio(audioRequest("arbitrary"), state.env);
  assert.equal(state.azureCalls, 2);
  assert.equal(state.bucket.objects.size, 0);
  assert.deepEqual(state.points.map((point) => point.blobs[17]), ["arbitrary", "arbitrary"]);
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
