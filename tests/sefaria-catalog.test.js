const assert = require("node:assert/strict");
const test = require("node:test");

const {
  haggadot,
  keyForQuery,
  mahzorim,
  resultsForKey,
  resultsForQuery,
  siddurim
} = require("../site/sefaria-catalog");

test("recognizes the generic English and Hebrew browse searches", () => {
  assert.equal(keyForQuery("Siddur"), "siddur");
  assert.equal(keyForQuery("machzorim"), "mahzor");
  assert.equal(keyForQuery("Hagaddah"), "haggadah");
  assert.equal(keyForQuery("Pirkei Avot"), "pirkei_avot");
  assert.equal(keyForQuery("פרקי אבות"), "pirkei_avot");
  assert.equal(keyForQuery("נביאים"), "neviim");
  assert.equal(keyForQuery("Siddur Ashkenaz"), "");
});

test("catalogs Pirkei Avot as six directly browsable chapters", () => {
  const chapters = resultsForKey("pirkei_avot");
  assert.equal(chapters.length, 6);
  assert.deepEqual(chapters.map((entry) => entry.displayLabel), ["1", "2", "3", "4", "5", "6"]);
  assert.equal(chapters[0].ref, "Pirkei Avot 1");
  assert.equal(chapters[5].ref, "Pirkei Avot 6");
  assert.equal(chapters.every((entry) => entry.availability === "import-reference"), true);
});

test("catalogs actual Mahzor and Haggadah roots without commentary", () => {
  assert.equal(mahzorim.length, 10);
  assert.equal(haggadot.length, 2);
  assert.equal([...mahzorim, ...haggadot].every((entry) => entry.sampleRef), true);
  assert.equal([...mahzorim, ...haggadot].some((entry) => /Rabbi Sacks|Commentary/.test(entry.ref)), false);
});

test("catalogs the full Jewish divisions of Tanakh with chapter counts", () => {
  assert.equal(resultsForKey("torah").length, 5);
  assert.equal(resultsForKey("neviim").length, 21);
  assert.equal(resultsForKey("ketuvim").length, 13);
  assert.equal(resultsForKey("ketuvim").find((entry) => entry.ref === "Psalms").chapters, 150);
  assert.equal(resultsForKey("torah").find((entry) => entry.ref === "Genesis").chapters, 50);
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
