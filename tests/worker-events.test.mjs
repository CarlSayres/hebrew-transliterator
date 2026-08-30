import assert from "node:assert/strict";
import test from "node:test";

import { handleEvent } from "../worker/index.mjs";

function makeEnv() {
  const points = [];
  return {
    points,
    env: {
      USAGE: {
        writeDataPoint(point) {
          points.push(point);
        }
      }
    }
  };
}

function eventRequest(payload, origin = "https://hebrewtransliterator.com", cf = {}) {
  const request = new Request("https://hebrewtransliterator.com/api/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin
    },
    body: JSON.stringify(payload)
  });
  Object.defineProperty(request, "cf", { value: cf });
  return request;
}

test("records a whitelisted event with Cloudflare geographic dimensions", async () => {
  const { env, points } = makeEnv();
  env.CF_VERSION_METADATA = {
    id: "version-id",
    tag: "release-tag",
    timestamp: "2026-08-26T05:00:00Z"
  };
  const result = await handleEvent(
    eventRequest(
      { schemaVersion: 2, event: "transliteration_copied" },
      "https://hebrewtransliterator.com",
      {
        continent: "NA",
        country: "US",
        region: "New York",
        regionCode: "NY",
        city: "New York",
        postalCode: "10001",
        metroCode: "501",
        timezone: "America/New_York",
        isEUCountry: "0",
        colo: "EWR",
        latitude: "40.7128",
        longitude: "-74.0060"
      }
    ),
    env
  );

  assert.equal(result.status, 204);
  assert.deepEqual(points, [{
    indexes: ["transliteration_copied"],
    blobs: [
      "schema-3",
      "client-schema-2",
      "version-id",
      "release-tag",
      "2026-08-26T05:00:00Z",
      "hebrewtransliterator.com",
      "NA",
      "US",
      "New York",
      "NY",
      "New York",
      "10001",
      "501",
      "America/New_York",
      "0",
      "EWR",
      "1",
      ""
    ],
    doubles: [1, 40.7128, -74.006]
  }]);
});

test("accepts cached version 1 clients while storing the geographic schema", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 1, event: "style_selected" }),
    env
  );

  assert.equal(result.status, 204);
  assert.equal(points[0].blobs[0], "schema-3");
  assert.equal(points[0].blobs[1], "client-schema-1");
  assert.equal(points[0].blobs[16], "0");
  assert.deepEqual(points[0].doubles, [1, 0, 0]);
});

test("accepts aggregate copy and speech action events without text", async () => {
  for (const event of ["hebrew_copied", "speech_started"]) {
    const { env, points } = makeEnv();
    const result = await handleEvent(eventRequest({ schemaVersion: 2, event }), env);
    assert.equal(result.status, 204);
    assert.deepEqual(points[0].indexes, [event]);
  }
});

test("records audio actions with only their source classification", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 3, event: "audio_listened", sourceType: "sefaria" }),
    env
  );
  assert.equal(result.status, 204);
  assert.equal(points[0].blobs[17], "sefaria");
});

test("rejects audio analytics without a valid source classification", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 3, event: "audio_downloaded", sourceType: "private text" }),
    env
  );
  assert.equal(result.status, 400);
  assert.deepEqual(points, []);
});

test("rejects extra fields so text and queries cannot enter analytics", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 2, event: "transliteration_copied", text: "private" }),
    env
  );

  assert.equal(result.status, 400);
  assert.deepEqual(points, []);
});

test("rejects unknown events and unapproved origins", async () => {
  const first = makeEnv();
  const unknown = await handleEvent(
    eventRequest({ schemaVersion: 2, event: "raw_search_query" }),
    first.env
  );
  assert.equal(unknown.status, 400);
  assert.deepEqual(first.points, []);

  const second = makeEnv();
  const wrongOrigin = await handleEvent(
    eventRequest({ schemaVersion: 2, event: "style_selected" }, "https://example.com"),
    second.env
  );
  assert.equal(wrongOrigin.status, 403);
  assert.deepEqual(second.points, []);
});

test("rejects oversized payloads", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 2, event: "style_selected", padding: "x".repeat(600) }),
    env
  );

  assert.equal(result.status, 413);
  assert.deepEqual(points, []);
});
