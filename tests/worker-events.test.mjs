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

function eventRequest(payload, origin = "https://hebrewtransliterator.com") {
  return new Request("https://hebrewtransliterator.com/api/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin
    },
    body: JSON.stringify(payload)
  });
}

test("records only a whitelisted event name and schema version", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 1, event: "transliteration_copied" }),
    env
  );

  assert.equal(result.status, 204);
  assert.deepEqual(points, [{
    indexes: ["transliteration_copied"],
    blobs: ["schema-1"],
    doubles: [1]
  }]);
});

test("rejects extra fields so text and queries cannot enter analytics", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 1, event: "transliteration_copied", text: "private" }),
    env
  );

  assert.equal(result.status, 400);
  assert.deepEqual(points, []);
});

test("rejects unknown events and unapproved origins", async () => {
  const first = makeEnv();
  const unknown = await handleEvent(
    eventRequest({ schemaVersion: 1, event: "raw_search_query" }),
    first.env
  );
  assert.equal(unknown.status, 400);
  assert.deepEqual(first.points, []);

  const second = makeEnv();
  const wrongOrigin = await handleEvent(
    eventRequest({ schemaVersion: 1, event: "style_selected" }, "https://example.com"),
    second.env
  );
  assert.equal(wrongOrigin.status, 403);
  assert.deepEqual(second.points, []);
});

test("rejects oversized payloads", async () => {
  const { env, points } = makeEnv();
  const result = await handleEvent(
    eventRequest({ schemaVersion: 1, event: "style_selected", padding: "x".repeat(600) }),
    env
  );

  assert.equal(result.status, 413);
  assert.deepEqual(points, []);
});
