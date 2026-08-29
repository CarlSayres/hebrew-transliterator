const test = require("node:test");
const assert = require("node:assert/strict");
const speech = require("../site/speech");

test("removes displayed line numbers before speaking", () => {
  assert.equal(
    speech.prepareText("4. Sh'ma yisra·eil\n5. V'ahavta"),
    "Sh'ma yisra·eil\nV'ahavta"
  );
});

test("preserves transliteration punctuation and diacritics", () => {
  assert.equal(speech.prepareText("  Ya·akov, ḥazak!  "), "Ya·akov, ḥazak!");
});

test("splits long readings at word boundaries", () => {
  const result = speech.chunks("Alpha beta gamma delta epsilon zeta eta theta.", 20);
  assert.deepEqual(result, ["Alpha beta gamma", "delta epsilon zeta", "eta theta."]);
  assert.ok(result.every((chunk) => chunk.length <= 20));
});

test("returns no utterances for empty text", () => {
  assert.deepEqual(speech.chunks(" \n  "), []);
});

test("prefers a transliteration selection and otherwise returns all text", () => {
  const text = "Sh'ma yisra·eil Adonai";
  assert.equal(speech.selectedOrAll(text, { start: 6, end: 15 }), "yisra·eil");
  assert.equal(speech.selectedOrAll(text, null), text);
});
