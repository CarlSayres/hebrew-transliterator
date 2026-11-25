import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { AudioQueue, handleAudio, handleAudioLexicon } from "../worker/index.mjs";

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

function audioRequest(
  sourceType = "sefaria",
  text = "בָּרוּךְ",
  sourceRef = "Siddur Ashkenaz, Weekday, Shacharit",
  lexicon = [{ grapheme: "בָּרוּךְ", phoneme: "ba.ˈʁux" }]
) {
  const request = new Request("https://hebrewtransliterator.com/api/audio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://hebrewtransliterator.com" },
    body: JSON.stringify({
      schemaVersion: 2,
      sourceType,
      sourceRef: sourceType === "sefaria" ? sourceRef : "",
      text,
      tzere: "ei",
      lexicon
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
  const queues = new Map();
  const state = {
    bucket,
    points,
    azureBodies,
    get azureCalls() { return azureCalls; },
    env: {
      AUDIO_BUCKET: bucket,
      AUDIO_COORDINATOR: {
        getByName(name) {
          if (!queues.has(name)) queues.set(name, new AudioQueue(state.env));
          return { fetch: (url, init) => queues.get(name).fetch(new Request(url, init)) };
        }
      },
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
  return state;
}

test("uses fixed Hila settings, stores Sefaria audio, and reuses the cache", async () => {
  const state = makeEnv();
  const first = await handleAudio(audioRequest(), state.env);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("X-Audio-Cache"), "MISS");
  assert.match(state.azureBodies[0], /voice name="he-IL-HilaNeural"/);
  assert.match(state.azureBodies[0], /prosody rate="-60%"/);
  const lexiconUrl = state.azureBodies[0].match(/<lexicon uri="([^"]+)"\/>/u)?.[1];
  assert.match(
    lexiconUrl,
    /^https:\/\/hebrew-transliterator\.carl-6b2\.workers\.dev\/api\/audio\/lexicon\/[a-f0-9-]{36}\.xml$/u
  );
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

test("word spacing bypasses recordings generated with the previous pacing", async () => {
  const state = makeEnv();
  const text = "בָּרוּךְ".normalize("NFC");
  const previousIdentity = JSON.stringify({
    text, pronunciation: [[text, "ba.ˈʁux"]], voice: "he-IL-HilaNeural",
    rate: "-60%", tzere: "ei", rules: "ipa-v7", format: "audio-24khz-48kbitrate-mono-mp3"
  });
  const oldKey = `audio/${createHash("sha256").update(previousIdentity).digest("hex")}.mp3`;
  await state.bucket.put(oldKey, new Uint8Array([1]), {
    customMetadata: { rules: "ipa-v7" }
  });
  const first = await handleAudio(audioRequest(), state.env);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("X-Audio-Cache"), "MISS");
  assert.equal(state.azureCalls, 1);
  assert.ok(state.bucket.objects.has(oldKey));
  const newAudio = [...state.bucket.objects.entries()].filter(
    ([key]) => key.startsWith("audio/") && key !== oldKey
  );
  assert.equal(newAudio.length, 1);
  assert.equal(newAudio[0][1].customMetadata.rules, "ipa-v7");
  const second = await handleAudio(audioRequest(), state.env);
  assert.equal(second.headers.get("X-Audio-Cache"), "HIT");
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
  const spokenSentence = state.azureBodies[0].match(/<s>(.*?)<\/s>/u)?.[1] || "";
  assert.doesNotMatch(spokenSentence, /English|שלום|42/u);

  const rejected = await handleAudio(audioRequest("arbitrary", "English שלום 42"), state.env);
  assert.equal(rejected.status, 400);
});

test("reports an oversized audio passage as too long", async () => {
  const state = makeEnv();
  const text = "בָּרוּךְ ".repeat(1200);
  const result = await handleAudio(audioRequest("arbitrary", text), state.env);
  assert.equal(result.status, 413);
  assert.equal(state.azureCalls, 0);
});

test("keeps a recognized unvocalized word and its IPA lexicon entry", async () => {
  const state = makeEnv();
  const result = await handleAudio(
    audioRequest(
      "arbitrary",
      "English יהוה שלום",
      "",
      [{ grapheme: "יהוה", phoneme: "a.do.ˈnaj" }]
    ),
    state.env
  );
  assert.equal(result.status, 200);
  assert.match(state.azureBodies[0], /<s>יהוה<\/s>/u);
  assert.doesNotMatch(state.azureBodies[0], /English|שלום/u);
  const debugLexicon = [...state.bucket.objects.entries()].find(([key]) => key.startsWith("debug/lexicons/"));
  assert.match(debugLexicon[1].body, /<grapheme>יהוה<\/grapheme><phoneme>a\.do\.ˈnaj<\/phoneme>/u);
});

test("joins a maqaf compound into one uninterrupted Azure pronunciation unit", async () => {
  const state = makeEnv();
  const result = await handleAudio(
    audioRequest(
      "arbitrary",
      "זַרְעוֹ־ב֖וֹ",
      "",
      [{ grapheme: "זַרְעוֹב֖וֹ", phoneme: "zaʁ.ʔo.ˈvo" }]
    ),
    state.env
  );
  assert.equal(result.status, 200);
  assert.ok(state.azureBodies[0].includes("<s>זַרְעוֹב֖וֹ</s>".normalize("NFC")));
  assert.doesNotMatch(state.azureBodies[0], /־/u);
});

test("gives ordinary word boundaries a short break and preserves punctuation and maqaf phrasing", async () => {
  const state = makeEnv();
  const words = ["שְׁמַע", "יִשְׂרָאֵל", "בְנֵי־יַעֲקֹב"];
  const lexicon = words.map((word, index) => ({
    grapheme: word.replace("־", "").normalize("NFC"),
    phoneme: ["ʃe.ˈma", "jis.ʁa.ˈʔel", "ve.nej.ja.ˈʔa.kov"][index]
  }));
  const result = await handleAudio(audioRequest("arbitrary", words.join(" ") + ", שְׁמַע׃", "", lexicon), state.env);
  assert.equal(result.status, 200);
  const [first, second, compound] = lexicon.map((entry) => entry.grapheme);
  const gap = ' <break time="50ms"/> ';
  assert.ok(state.azureBodies[0].includes(`<s>${first}${gap}${second}${gap}${compound}, ${first}׃</s>`));
});

test("accepts canonically normalized maqaf compounds from a full Tanakh chapter", async () => {
  const state = makeEnv();
  const text = "בִּן־נוּן֙ יַם־סֽוּף";
  const lexicon = [
    { grapheme: "בִּןנוּן֙".normalize("NFC"), phoneme: "bin.ˈnun" },
    { grapheme: "יַםסֽוּף".normalize("NFC"), phoneme: "jam.ˈsuf" }
  ];
  const result = await handleAudio(audioRequest("arbitrary", text, "", lexicon), state.env);
  assert.equal(result.status, 200);
  assert.ok(state.azureBodies[0].includes("בִּןנוּן֙".normalize("NFC")));
  assert.ok(state.azureBodies[0].includes("יַםסֽוּף".normalize("NFC")));
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

test("serializes simultaneous generation and metadata updates by recording", async () => {
  const state = makeEnv();
  const read = (ref) => handleAudio(audioRequest("sefaria", "בָּרוּךְ", ref), state.env);
  const results = await Promise.all(["A", "B", "C"].map(read));
  assert.deepEqual(results.map((r) => r.headers.get("X-Audio-Cache")).sort(), ["HIT", "HIT", "MISS"]);
  await Promise.all(["D", "E"].map(read));
  const object = [...state.bucket.objects].find(([key]) => key.startsWith("audio/"))[1];
  assert.deepEqual(object.customMetadata.sefariaReferences.split(" | ").sort(), ["A", "B", "C", "D", "E"]);
  assert.equal(state.azureCalls, 1);
  assert.equal(state.points.length, 1);
});

test("caches each IPA pronunciation separately and retries a failed synthesis", async () => {
  const state = makeEnv();
  const fetch = state.env.AZURE_SPEECH_FETCH;
  state.env.AZURE_SPEECH_FETCH = async () => new Response(null, { status: 503 });
  assert.equal((await handleAudio(audioRequest(), state.env)).status, 502);
  state.env.AZURE_SPEECH_FETCH = fetch;
  await handleAudio(audioRequest(), state.env);
  const changed = () => audioRequest("sefaria", "בָּרוּךְ", "Example", [{ grapheme: "בָּרוּךְ", phoneme: "ˈba.ʁux" }]);
  assert.equal((await handleAudio(changed(), state.env)).headers.get("X-Audio-Cache"), "MISS");
  assert.equal((await handleAudio(changed(), state.env)).headers.get("X-Audio-Cache"), "HIT");
  assert.equal(state.azureCalls, 2);
});
