import assert from "node:assert/strict";
import test from "node:test";

import { handleFeedback } from "../worker/index.mjs";

function feedbackRequest(payload, options = {}) {
  const request = new Request("https://hebrewtransliterator.com/api/feedback", {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin || "https://hebrewtransliterator.com",
      "CF-Connecting-IP": options.ip || "192.0.2.4"
    },
    body: options.method === "GET" ? undefined : JSON.stringify(payload)
  });
  Object.defineProperty(request, "cf", { value: { country: "US" } });
  return request;
}

function makeEnv(rateSuccess = true) {
  const emails = [];
  const rateKeys = [];
  return {
    emails,
    rateKeys,
    env: {
      FEEDBACK_RECIPIENT: "owner@example.com",
      RESEND_API_KEY: "re_test_key",
      FEEDBACK_RATE_LIMITER: {
        async limit({ key }) {
          rateKeys.push(key);
          return { success: rateSuccess };
        }
      },
      async RESEND_FETCH(url, options) {
        emails.push({ url, options, ...JSON.parse(options.body) });
        return new Response(JSON.stringify({ id: "test-message" }), { status: 200 });
      }
    }
  };
}

const validPayload = {
  type: "problem",
  message: "The selected passage did not import.",
  website: "",
  context: {
    query: "Pirkei Avot",
    ref: "Pirkei Avot 1.1",
    versionTitle: "Torat Emet 357",
    text: "משֶׁה קִבֵּל תּוֹרָה"
  }
};

test("sends validated feedback with the explicitly supplied Sefaria context", async () => {
  const { env, emails, rateKeys } = makeEnv();
  const result = await handleFeedback(feedbackRequest(validPayload), env);

  assert.equal(result.status, 204);
  assert.deepEqual(rateKeys, ["192.0.2.4"]);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].url, "https://api.resend.com/emails");
  assert.deepEqual(emails[0].to, ["owner@example.com"]);
  assert.equal(emails[0].from, "Hebrew Transliterator <feedback@mail.hebrewtransliterator.com>");
  assert.equal(emails[0].options.headers.Authorization, "Bearer re_test_key");
  assert.match(emails[0].text, /Pirkei Avot 1\.1/);
  assert.equal(emails[0].text.includes(validPayload.context.text.normalize("NFC")), true);
});

test("allows anonymous feedback without Sefaria context", async () => {
  const { env, emails } = makeEnv();
  const result = await handleFeedback(feedbackRequest({
    type: "suggestion",
    message: "Please add another style.",
    website: "",
    context: null
  }), env);

  assert.equal(result.status, 204);
  assert.equal(emails.length, 1);
  assert.doesNotMatch(emails[0].text, /Sefaria context/);
});

test("silently discards honeypot submissions", async () => {
  const { env, emails, rateKeys } = makeEnv();
  const result = await handleFeedback(feedbackRequest({
    ...validPayload,
    website: "https://spam.example"
  }), env);

  assert.equal(result.status, 204);
  assert.deepEqual(rateKeys, []);
  assert.deepEqual(emails, []);
});

test("rate limits repeated feedback", async () => {
  const { env, emails } = makeEnv(false);
  const result = await handleFeedback(feedbackRequest(validPayload), env);

  assert.equal(result.status, 429);
  assert.deepEqual(emails, []);
});

test("rejects unapproved origins, extra fields, and oversized context", async () => {
  const wrongOrigin = makeEnv();
  assert.equal(
    (await handleFeedback(feedbackRequest(validPayload, { origin: "https://example.com" }), wrongOrigin.env)).status,
    403
  );

  const extraField = makeEnv();
  assert.equal(
    (await handleFeedback(feedbackRequest({ ...validPayload, email: "person@example.com" }), extraField.env)).status,
    400
  );

  const oversized = makeEnv();
  assert.equal(
    (await handleFeedback(feedbackRequest({
      ...validPayload,
      context: { ...validPayload.context, text: "א".repeat(20001) }
    }), oversized.env)).status,
    400
  );
});
