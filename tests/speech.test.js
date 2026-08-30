const test = require("node:test");
const assert = require("node:assert/strict");
const speech = require("../site/speech");

test("removes displayed line numbers before speaking", () => {
  assert.equal(
    speech.prepareText("4. Sh'ma yisra·eil\n5. V'ahavta"),
    "Sh'ma yisra·eil\nV'ahavta"
  );
});

test("preserves transliteration punctuation and diacritics", () => {
  assert.equal(speech.prepareText("  Ya·akov, ḥazak!  "), "Ya·akov, ḥazak!");
});

test("splits long readings at word boundaries", () => {
  const result = speech.chunks("Alpha beta gamma delta epsilon zeta eta theta.", 20);
  assert.deepEqual(result, ["Alpha beta gamma", "delta epsilon zeta", "eta theta."]);
  assert.ok(result.every((chunk) => chunk.length <= 20));
});

test("returns no utterances for empty text", () => {
  assert.deepEqual(speech.chunks(" \n  "), []);
});

test("prefers a transliteration selection and otherwise returns all text", () => {
  const text = "Sh'ma yisra·eil Adonai";
  assert.equal(speech.selectedOrAll(text, { start: 6, end: 15 }), "yisra·eil");
  assert.equal(speech.selectedOrAll(text, null), text);
});

test("maps a transliteration selection back to its Hebrew source word", () => {
  const source = "שְׁמַע יִשְׂרָאֵל";
  const secondWordStart = source.indexOf("יִ");
  const segments = [
    { sourceStart: 0, sourceEnd: secondWordStart - 1, targetStart: 0, targetEnd: 5 },
    { sourceStart: secondWordStart, sourceEnd: source.length, targetStart: 6, targetEnd: 14 }
  ];
  assert.equal(
    speech.sourceForTargetSelection(source, segments, { start: 7, end: 12 }),
    "יִשְׂרָאֵל"
  );
});

test("renders English-friendly syllables for speech", () => {
  assert.equal(
    speech.phoneticize("Shema yisra·eil Adonai Eloheinu"),
    "sheh-mah yees-rah-ayl ah-doh-nye eh-loh-hay-noo"
  );
  assert.equal(speech.phoneticize("Bereishit"), "beh-ray-sheet");
});

test("makes the speech ruleset follow the selected tzere pronunciation", () => {
  const base = {
    vowels: { tzere: "ei" },
    exceptions: {
      exactWords: { word: "Eloheinu" },
      niqqudless: { word: "Elohei" },
      phraseCapitalization: {}
    }
  };
  const eRuleset = speech.rulesetForTzere(base, "e");
  const eiRuleset = speech.rulesetForTzere(base, "ei");
  assert.equal(eRuleset.vowels.tzere, "e");
  assert.equal(eRuleset.exceptions.exactWords.word, "Elohenu");
  assert.equal(eiRuleset.exceptions.exactWords.word, "Eloheinu");
});

test("prepares vocalized Hebrew for a native Hebrew voice", () => {
  assert.equal(
    speech.hebrewForSpeech("יְהֹוָ֔ה מֶֽלֶךְ׃"),
    "אֲדֹנָי מֶלֶךְ:"
  );
});
