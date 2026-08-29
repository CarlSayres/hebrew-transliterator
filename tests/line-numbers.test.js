const test = require("node:test");
const assert = require("node:assert/strict");
const lineNumbers = require("../site/line-numbers");

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
