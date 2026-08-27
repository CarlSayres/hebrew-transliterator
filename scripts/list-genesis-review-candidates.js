const fs = require("fs");
const path = require("path");
const {
  loadTransliterator,
  transliterateGenesis
} = require("./genesis-audit");

const root = path.resolve(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "genesis", "source.json"), "utf8"));
const expected = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "genesis", "transliterations.json"), "utf8"));
const actual = transliterateGenesis(source, loadTransliterator());
const expectedRows = new Map(expected.rows.map((row) => [row.ref, row]));
const groups = new Map();

for (const row of actual.rows) {
  const expectedRow = expectedRows.get(row.ref);
  if (!expectedRow) {
    continue;
  }

  const hebrewTokens = row.hebrew.split(/\s+/);
  for (const [style, actualOutput] of Object.entries(row.outputs)) {
    const expectedTokens = expectedRow.outputs[style].split(/\s+/);
    const actualTokens = actualOutput.split(/\s+/);
    if (expectedTokens.length !== actualTokens.length || hebrewTokens.length !== actualTokens.length) {
      continue;
    }

    for (let index = 0; index < actualTokens.length; index += 1) {
      if (expectedTokens[index] === actualTokens[index]) {
        continue;
      }

      const key = [hebrewTokens[index], expectedTokens[index], actualTokens[index]].join("\t");
      const group = groups.get(key) || {
        hebrew: hebrewTokens[index],
        expected: expectedTokens[index],
        actual: actualTokens[index],
        count: 0,
        styles: new Set(),
        refs: new Set()
      };
      group.count += 1;
      group.styles.add(style);
      group.refs.add(row.ref);
      groups.set(key, group);
    }
  }
}

const output = [...groups.values()]
  .sort((left, right) => right.count - left.count || left.hebrew.localeCompare(right.hebrew))
  .map((group) => ({
    ...group,
    styles: [...group.styles],
    refs: [...group.refs]
  }));

console.log(JSON.stringify(output, null, 2));
