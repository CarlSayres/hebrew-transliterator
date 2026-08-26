const fs = require("fs");
const path = require("path");
const {
  loadTransliterator,
  transliterateGenesis
} = require("../scripts/genesis-audit");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "tests", "fixtures", "genesis", "source.json");
const snapshotPath = path.join(root, "tests", "fixtures", "genesis", "transliterations.json");

if (!fs.existsSync(sourcePath) || !fs.existsSync(snapshotPath)) {
  console.log("Genesis snapshot test skipped. Run scripts/genesis-audit.js --download to create fixtures.");
  process.exit(0);
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const actual = transliterateGenesis(source, loadTransliterator());

const failures = [];
const expectedRows = new Map(expected.rows.map((row) => [row.ref, row]));

for (const row of actual.rows) {
  const expectedRow = expectedRows.get(row.ref);
  if (!expectedRow) {
    failures.push({ ref: row.ref, issue: "missing snapshot row" });
    continue;
  }

  for (const [style, output] of Object.entries(row.outputs)) {
    if (expectedRow.outputs[style] !== output) {
      failures.push({
        ref: row.ref,
        style,
        expected: expectedRow.outputs[style],
        actual: output
      });
    }
  }
}

if (failures.length) {
  console.error("Genesis snapshot failures:");
  for (const failure of failures) {
    console.error(JSON.stringify(failure));
  }
  process.exit(1);
}

console.log(`${actual.rows.length} Genesis snapshot rows passed.`);
