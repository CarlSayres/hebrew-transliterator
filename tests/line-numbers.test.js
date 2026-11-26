const test = require("node:test");
const assert = require("node:assert/strict");
const lineNumbers = require("../site/line-numbers");

test("edited lines keep surviving verse labels across toggles and chapter boundaries", () => {
  const original = "31. last\n1. first\n3. third";
  const changed = "1. first\n2024. a note\n3. changed";
  const labels = lineNumbers.afterEdit(original, changed, [31, 1, 3], true);
  assert.deepEqual(labels, [1, null, 3]);
  const hidden = lineNumbers.remove(changed, labels);
  assert.equal(hidden, "first\n2024. a note\nchanged");
  assert.equal(lineNumbers.add(hidden, labels), changed);
  const shorter = "2024. a note\nchanged";
  const shorterLabels = lineNumbers.afterEdit(hidden, shorter, labels, false);
  assert.equal(lineNumbers.add(shorter, shorterLabels), "2024. a note\n3. changed");
});

test("starts a same-chapter verse range at its actual first verse", () => {
  assert.equal(lineNumbers.startFromRef("Deuteronomy 6:4-9"), 4);
  assert.equal(lineNumbers.add("first\nsecond\nthird", 4), "4. first\n5. second\n6. third");
});

test("recognizes a single verse and a typographic range dash", () => {
  assert.equal(lineNumbers.startFromRef("Psalms 150:6"), 6);
  assert.equal(lineNumbers.startFromRef("Deuteronomy 6:4–9"), 4);
});

test("supports Pirkei Avot references", () => {
  assert.equal(lineNumbers.startFromRef("Pirkei Avot 2:4-7"), 4);
});

test("whole chapters and non-numeric sections begin at one", () => {
  assert.equal(lineNumbers.startFromRef("Genesis 6"), 1);
  assert.equal(lineNumbers.startFromRef("Siddur Ashkenaz, Weekday, Shacharit"), 1);
});

test("removes the same offset numbers without disturbing other leading numbers", () => {
  const numbered = "4. first\n5. 2024. remains\n6. third";
  assert.equal(lineNumbers.remove(numbered, 4), "first\n2024. remains\nthird");
});
