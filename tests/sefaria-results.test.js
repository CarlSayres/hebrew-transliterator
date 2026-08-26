const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isImportableSearchResult,
  normalizeRefKey,
  prepareResults
} = require("../site/sefaria-results");

test("normalizes equivalent Sefaria references for deduplication", () => {
  assert.equal(
    normalizeRefKey(" Siddur Ashkenaz,  Weekday, Shema 1 "),
    "siddur ashkenaz, weekday, shema 1"
  );
});

test("keeps Tanakh and liturgy while excluding commentary and unrelated texts", () => {
  assert.equal(isImportableSearchResult({ ref: "Genesis 1:1", categories: ["Tanakh"] }), true);
  assert.equal(isImportableSearchResult({ ref: "Siddur Ashkenaz, Weekday", categories: ["Liturgy"] }), true);
  assert.equal(isImportableSearchResult({ ref: "A Prayer Collection", categories: "Liturgy" }), true);
  assert.equal(isImportableSearchResult({ ref: "Rashi on Genesis 1:1", categories: ["Commentary"] }), false);
  assert.equal(isImportableSearchResult({ ref: "Mishnah Berakhot 1:1", categories: ["Mishnah"] }), false);
  assert.equal(isImportableSearchResult({ ref: "Piskei HaSiddur, Bedtime Shema", categories: ["Halakhah"] }), false);
  assert.equal(isImportableSearchResult({ ref: "Weekday Siddur Chabad", source: "catalog" }), true);
});

test("ranks exact references and curated aliases before broad search hits", () => {
  const results = prepareResults([
    { ref: "Psalms 23:1", categories: ["Tanakh"], source: "search" },
    { ref: "Deuteronomy 6:4-9", categories: ["Tanakh"], source: "search" },
    { ref: "Siddur Ashkenaz, Weekday, Shema 1", categories: ["Liturgy"], source: "alias" },
    { ref: "Deuteronomy 6:4-9", categories: ["Tanakh"], source: "name" }
  ], "Deuteronomy 6:4-9");

  assert.deepEqual(results.map((result) => result.ref), [
    "Deuteronomy 6:4-9",
    "Siddur Ashkenaz, Weekday, Shema 1",
    "Psalms 23:1"
  ]);
});

test("deduplicates references despite case and spacing differences", () => {
  const results = prepareResults([
    { ref: "Genesis 1:1", categories: ["Tanakh"] },
    { ref: " genesis  1:1 ", categories: ["Tanakh"] },
    { ref: "Genesis 1:2", categories: ["Tanakh"] }
  ]);

  assert.deepEqual(results.map((result) => result.ref), ["Genesis 1:1", "Genesis 1:2"]);
});

test("excludes fuzzy book-level matches unless the query names that book", () => {
  const phraseResults = prepareResults([
    { ref: "Micah", categories: ["Tanakh"], source: "name" },
    { ref: "Proverbs", categories: ["Tanakh"], source: "name" },
    { ref: "Exodus 15:11", categories: ["Tanakh"], source: "alias" }
  ], "Mi Chamocha");
  assert.deepEqual(phraseResults.map((result) => result.ref), ["Exodus 15:11"]);

  const bookResults = prepareResults([
    { ref: "Genesis", categories: ["Tanakh"], source: "name" }
  ], "Genesis");
  assert.deepEqual(bookResults.map((result) => result.ref), ["Genesis"]);
});
