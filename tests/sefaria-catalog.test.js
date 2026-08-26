const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isSiddurCatalogQuery,
  resultsForQuery,
  siddurim
} = require("../site/sefaria-catalog");

test("recognizes generic English and Hebrew siddur searches", () => {
  assert.equal(isSiddurCatalogQuery("Siddur"), true);
  assert.equal(isSiddurCatalogQuery("siddurim"), true);
  assert.equal(isSiddurCatalogQuery("סידור"), true);
  assert.equal(isSiddurCatalogQuery("Siddur Ashkenaz"), false);
});

test("catalogs only the seven usable Sefaria siddur roots", () => {
  assert.equal(siddurim.length, 7);
  assert.equal(siddurim.every((entry) => entry.sampleRef), true);
  assert.equal(siddurim.some((entry) => /Rashi|Rabbi Sacks/.test(entry.ref)), false);
  assert.deepEqual(
    resultsForQuery("Siddur").map((entry) => entry.ref),
    siddurim.map((entry) => entry.ref)
  );
});

test("does not replace specific Sefaria searches with the catalog", () => {
  assert.deepEqual(resultsForQuery("Siddur Ashkenaz"), []);
  assert.deepEqual(resultsForQuery("Shema"), []);
});
