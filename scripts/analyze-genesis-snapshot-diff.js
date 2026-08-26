const path = require("path");
const fs = require("fs");
const {
  loadTransliterator,
  transliterateGenesis
} = require("./genesis-audit");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "tests", "fixtures", "genesis", "source.json");
const snapshotPath = path.join(root, "tests", "fixtures", "genesis", "transliterations.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const actual = transliterateGenesis(source, loadTransliterator());
const expectedRows = new Map(expected.rows.map((row) => [row.ref, row]));
const changedRefs = new Set();
const failuresByStyle = {};
const tokenPairs = new Map();
let failures = 0;
let tokenCountMismatches = 0;
let unchangedHebrewOutputs = 0;

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

for (const row of actual.rows) {
  const expectedRow = expectedRows.get(row.ref);
  if (!expectedRow) {
    failures += 1;
    changedRefs.add(row.ref);
    continue;
  }

  for (const [style, actualOutput] of Object.entries(row.outputs)) {
    const expectedOutput = expectedRow.outputs[style];
    if (expectedOutput === actualOutput) {
      continue;
    }

    failures += 1;
    changedRefs.add(row.ref);
    failuresByStyle[style] = (failuresByStyle[style] || 0) + 1;
    if (/\p{Script=Hebrew}/u.test(actualOutput)) {
      unchangedHebrewOutputs += 1;
    }

    const expectedTokens = expectedOutput.split(/\s+/);
    const actualTokens = actualOutput.split(/\s+/);
    if (expectedTokens.length !== actualTokens.length) {
      tokenCountMismatches += 1;
      continue;
    }

    for (let index = 0; index < expectedTokens.length; index += 1) {
      if (expectedTokens[index] !== actualTokens[index]) {
        increment(tokenPairs, `${expectedTokens[index]}\t${actualTokens[index]}`);
      }
    }
  }
}

const commonTokenChanges = [...tokenPairs.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .slice(0, 75)
  .map(([pair, count]) => {
    const [expectedToken, actualToken] = pair.split("\t");
    return { expected: expectedToken, actual: actualToken, count };
  });

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceRows: actual.rows.length,
  expectedRows: expected.rows.length,
  styles: Object.keys(actual.rows[0]?.outputs || {}),
  failures,
  changedReferenceCount: changedRefs.size,
  failuresByStyle,
  tokenCountMismatches,
  unchangedHebrewOutputs,
  commonTokenChanges
}, null, 2));
