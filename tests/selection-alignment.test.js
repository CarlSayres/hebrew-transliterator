const test = require("node:test");
const assert = require("node:assert/strict");
const selectionAlignment = require("../site/selection-alignment");

const segments = [
  { sourceStart: 3, sourceEnd: 8, targetStart: 3, targetEnd: 8 },
  { sourceStart: 9, sourceEnd: 18, targetStart: 9, targetEnd: 18 },
  { sourceStart: 19, sourceEnd: 24, targetStart: 19, targetEnd: 25 }
];

test("maps a partial source selection to its complete aligned word", () => {
  assert.deepEqual(selectionAlignment.matchingIndexes(segments, 5, 6, "source"), [0]);
});

test("maps a target selection spanning punctuation to all intersecting words", () => {
  assert.deepEqual(selectionAlignment.matchingIndexes(segments, 7, 20, "target"), [0, 1, 2]);
});

test("does not highlight anything for a collapsed caret", () => {
  assert.deepEqual(selectionAlignment.matchingIndexes(segments, 6, 6, "source"), []);
});

test("merges touching ranges while preserving separated words", () => {
  const touching = [
    { sourceStart: 0, sourceEnd: 3, targetStart: 0, targetEnd: 3 },
    { sourceStart: 3, sourceEnd: 6, targetStart: 3, targetEnd: 6 },
    { sourceStart: 7, sourceEnd: 10, targetStart: 7, targetEnd: 10 }
  ];
  assert.deepEqual(selectionAlignment.mergedRanges(touching, [0, 1, 2], "source"), [
    { start: 0, end: 6 },
    { start: 7, end: 10 }
  ]);
});
