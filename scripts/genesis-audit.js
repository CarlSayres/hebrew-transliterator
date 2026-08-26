const fs = require("fs");
const https = require("https");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "tests", "fixtures", "genesis", "source.json");
const SNAPSHOT_PATH = path.join(ROOT, "tests", "fixtures", "genesis", "transliterations.json");
const REPORT_DIR = path.join(ROOT, "reports");
const IRREGULARITIES_PATH = path.join(REPORT_DIR, "genesis-irregularities.md");
const REVIEW_PATH = path.join(REPORT_DIR, "genesis-review.html");

const CHAPTER_COUNT = 50;
const HEBREW_RE = /[\u0590-\u05ff]/;
const ENTITY_RE = /&(?:[a-z]+|#[0-9]+|#x[0-9a-f]+);/gi;
const WORD_RE = /[\u0590-\u05ff][\u0590-\u05ff\u05b0-\u05bd\u05bf-\u05c7]*/g;
const LOWER_DIVINE_RE = /\b(?:adonai|elohim|elohei(?:nu|kha|khem|khen|hem|hen)?|elohai|elohav|el)\b/;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    gt: ">",
    lt: "<",
    nbsp: " ",
    thinsp: " ",
    quot: "\"",
    apos: "'"
  };

  return value.replace(ENTITY_RE, (entity) => {
    const body = entity.slice(1, -1).toLowerCase();
    if (named[body]) {
      return named[body];
    }
    if (body.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }
    return "";
  });
}

function cleanHebrew(value) {
  return decodeEntities(String(value))
    .replace(/<[^>]*>/g, "")
    .replace(/\{[פס]\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Hebrew-Transliterator-Audit" } }, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume();
          requestJson(response.headers.location).then(resolve, reject);
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode} from ${url}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Could not parse JSON from ${url}: ${error.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

function firstHebrewVersion(data) {
  const versions = Array.isArray(data.versions) ? data.versions : [];
  return versions.find((version) => Array.isArray(version.text)) || versions[0];
}

async function downloadChapter(chapter) {
  const ref = encodeURIComponent(`Genesis ${chapter}`);
  const url = `https://www.sefaria.org/api/v3/texts/${ref}?version=source&return_format=text_only`;
  const data = await requestJson(url);
  const version = firstHebrewVersion(data);
  const verses = Array.isArray(version?.text) ? version.text : [];

  return {
    chapter,
    sourceRef: data.ref || `Genesis ${chapter}`,
    versionTitle: version?.versionTitle || "source",
    verses: verses.map((hebrew, index) => ({
      verse: index + 1,
      hebrew: cleanHebrew(hebrew)
    }))
  };
}

async function downloadGenesis() {
  const chapters = [];
  for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter += 1) {
    process.stdout.write(`Downloading Genesis ${chapter}...\n`);
    chapters.push(await downloadChapter(chapter));
  }

  const fixture = {
    title: "Genesis",
    source: "Sefaria API v3, version=source, return_format=text_only",
    downloadedAt: new Date().toISOString(),
    chapters
  };
  writeJson(SOURCE_PATH, fixture);
  return fixture;
}

function loadFixture() {
  if (!fs.existsSync(SOURCE_PATH)) {
    return null;
  }
  return readJson(SOURCE_PATH);
}

function loadTransliterator() {
  const context = { window: {} };
  vm.createContext(context);

  for (const file of ["site/rulesets/modern-sefardi.js", "site/transliterator.js"]) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }

  return context.window;
}

function transliterateGenesis(fixture, windowObject) {
  const rows = [];
  const rulesets = windowObject.HebrewRulesets.all;

  for (const chapter of fixture.chapters) {
    for (const verse of chapter.verses) {
      const outputs = {};
      for (const ruleset of rulesets) {
        const transliterator = new windowObject.HebrewTransliterator.Transliterator(ruleset);
        outputs[ruleset.id] = transliterator.transliterate(verse.hebrew);
      }
      rows.push({
        ref: `Genesis ${chapter.chapter}:${verse.verse}`,
        chapter: chapter.chapter,
        verse: verse.verse,
        hebrew: verse.hebrew,
        outputs
      });
    }
  }

  return {
    title: "Genesis transliteration snapshots",
    generatedAt: new Date().toISOString(),
    sourceDownloadedAt: fixture.downloadedAt || null,
    rows
  };
}

function wordsIn(value) {
  return value.match(WORD_RE) || [];
}

function flagRow(row) {
  const flags = [];
  const modern = row.outputs.modernSefardi || "";
  const lev = row.outputs.levShalem || "";
  const mishkan = row.outputs.mishkanTefilah || "";
  const combined = Object.values(row.outputs).join(" ");

  if (/<[^>]*>/.test(row.hebrew) || ENTITY_RE.test(row.hebrew)) {
    flags.push("HTML/entity residue in Hebrew source");
  }
  if (HEBREW_RE.test(combined)) {
    flags.push("Hebrew characters leaked into transliteration");
  }
  if (/\bhahiv\b|\bhiv\b/i.test(combined)) {
    flags.push("Possible הוא/היא pronoun exception issue");
  }
  if (/hh/.test(combined)) {
    flags.push("Double h found; check mappiq heh style");
  }
  if (/(?:··|--|''|·-|'-|-·)/.test(combined)) {
    flags.push("Repeated or mixed separators");
  }
  if (LOWER_DIVINE_RE.test(modern)) {
    flags.push("Modern Sephardi divine name may need capitalization");
  }
  if (/ḥ/.test(mishkan)) {
    flags.push("Mishkan Tefilah should not contain ḥ");
  }
  if (/\b\w*ei\w*/i.test(modern.replace(/\bElohei\w*/g, ""))) {
    flags.push("Modern Sephardi contains ei; check tzere-yod or exception");
  }

  for (const word of wordsIn(row.hebrew)) {
    if (/[\u05b4][\u0590-\u05ea]\u05b0/.test(word) && /\w+e\w+/.test(modern)) {
      flags.push("Possible vocal sh'va after short hiriq");
      break;
    }
  }

  return [...new Set(flags)];
}

function buildAudit(snapshot) {
  const flaggedRows = [];
  const counts = new Map();

  for (const row of snapshot.rows) {
    const flags = flagRow(row);
    if (!flags.length) {
      continue;
    }
    flaggedRows.push({ ...row, flags });
    for (const flag of flags) {
      counts.set(flag, (counts.get(flag) || 0) + 1);
    }
  }

  return {
    totalVerses: snapshot.rows.length,
    flaggedRows,
    counts: [...counts.entries()].sort((a, b) => b[1] - a[1])
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeIrregularities(snapshot, audit) {
  ensureDir(IRREGULARITIES_PATH);
  const lines = [
    "# Genesis Transliteration Irregularities",
    "",
    `Generated: ${snapshot.generatedAt}`,
    `Verses scanned: ${audit.totalVerses}`,
    `Verses flagged: ${audit.flaggedRows.length}`,
    "",
    "## Flag Counts",
    ""
  ];

  for (const [flag, count] of audit.counts) {
    lines.push(`- ${flag}: ${count}`);
  }

  lines.push("", "## Flagged Verses", "");
  for (const row of audit.flaggedRows) {
    lines.push(`### ${row.ref}`);
    lines.push(`- Flags: ${row.flags.join("; ")}`);
    lines.push(`- Hebrew: ${row.hebrew}`);
    lines.push(`- Modern Sephardi: ${row.outputs.modernSefardi}`);
    lines.push(`- Lev Shalem: ${row.outputs.levShalem}`);
    lines.push(`- Mishkan Tefilah: ${row.outputs.mishkanTefilah}`);
    lines.push("");
  }

  fs.writeFileSync(IRREGULARITIES_PATH, `${lines.join("\n")}\n`, "utf8");
}

function writeReviewHtml(snapshot, audit) {
  ensureDir(REVIEW_PATH);
  const flaggedRefs = new Map(audit.flaggedRows.map((row) => [row.ref, row.flags]));
  const rows = snapshot.rows.map((row) => {
    const flags = flaggedRefs.get(row.ref) || [];
    return `<tr class="${flags.length ? "flagged" : ""}">
      <th>${escapeHtml(row.ref)}</th>
      <td dir="rtl" lang="he">${escapeHtml(row.hebrew)}</td>
      <td>${escapeHtml(row.outputs.modernSefardi)}</td>
      <td>${escapeHtml(row.outputs.levShalem)}</td>
      <td>${escapeHtml(row.outputs.mishkanTefilah)}</td>
      <td>${escapeHtml(flags.join("; "))}</td>
    </tr>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Genesis Transliteration Review</title>
  <style>
    body { margin: 24px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #24211c; }
    h1 { margin-bottom: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
    th, td { border: 1px solid #d8d1c4; padding: 8px; vertical-align: top; }
    th { width: 9rem; text-align: left; background: #f7f5ef; }
    td { word-wrap: break-word; }
    td[lang="he"] { font-family: "SBL Hebrew", "Ezra SIL", "Noto Serif Hebrew", serif; font-size: 1.25rem; line-height: 1.45; }
    .flagged { background: #fff8e8; }
    .meta { color: #6d675d; }
  </style>
</head>
<body>
  <h1>Genesis Transliteration Review</h1>
  <p class="meta">Generated ${escapeHtml(snapshot.generatedAt)}. ${audit.flaggedRows.length} of ${audit.totalVerses} verses flagged for review.</p>
  <table>
    <thead>
      <tr>
        <th>Ref</th>
        <th>Hebrew</th>
        <th>Modern Sephardi</th>
        <th>Lev Shalem</th>
        <th>Mishkan Tefilah</th>
        <th>Flags</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(REVIEW_PATH, html, "utf8");
}

async function main() {
  const shouldDownload = process.argv.includes("--download");
  const fixture = shouldDownload ? await downloadGenesis() : loadFixture();

  if (!fixture) {
    throw new Error(
      `No Genesis fixture found at ${SOURCE_PATH}. Run this script with --download when internet access is available.`
    );
  }

  const windowObject = loadTransliterator();
  const snapshot = transliterateGenesis(fixture, windowObject);
  const audit = buildAudit(snapshot);
  writeJson(SNAPSHOT_PATH, snapshot);
  writeIrregularities(snapshot, audit);
  writeReviewHtml(snapshot, audit);

  process.stdout.write(`Wrote ${SNAPSHOT_PATH}\n`);
  process.stdout.write(`Wrote ${IRREGULARITIES_PATH}\n`);
  process.stdout.write(`Wrote ${REVIEW_PATH}\n`);
  process.stdout.write(`Flagged ${audit.flaggedRows.length} of ${audit.totalVerses} verses.\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  cleanHebrew,
  flagRow,
  loadTransliterator,
  transliterateGenesis
};
