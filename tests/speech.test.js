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

test("offers only Hebrew speech voices", () => {
  const voices = [
    { name: "English", lang: "en-US" },
    { name: "Hebrew modern", lang: "he-IL" },
    { name: "Hebrew legacy", lang: "iw_IL" },
    { name: "French", lang: "fr-FR" }
  ];
  assert.deepEqual(
    speech.hebrewVoices(voices).map((voice) => voice.name),
    ["Hebrew modern", "Hebrew legacy"]
  );
  assert.deepEqual(speech.hebrewVoices([]), []);
});

test("canonicalizes Hebrew without destroying word boundaries", () => {
  assert.equal(
    speech.canonicalHebrew("4.  שְׁמַע   יִשְׂרָאֵל\n5. {ס} יְהֹוָה"),
    "שְׁמַע יִשְׂרָאֵל יְהֹוָה".normalize("NFC")
  );
});

test("keeps only genuinely vocalized Hebrew for Azure audio", () => {
  assert.equal(
    speech.vocalizedHebrewOnly("English: בָּרוּךְ שלום; שָׁלוֹם! {פ} 42"),
    "בָּרוּךְ; שָׁלוֹם!".normalize("NFC")
  );
  assert.equal(
    speech.vocalizedHebrewOnly("בָּרוּךְ־שלום שָׁלוֹם"),
    "בָּרוּךְ שָׁלוֹם".normalize("NFC")
  );
  assert.equal(
    speech.speakableHebrewOnly(
      "זַרְעוֹ־ב֖וֹ",
      [{ grapheme: "זַרְעוֹב֖וֹ", phoneme: "zaʁ.ʔo.ˈvo" }]
    ),
    "זַרְעוֹב֖וֹ".normalize("NFC")
  );
  assert.equal(
    speech.speakableHebrewOnly(
      "בִּן־נוּן֙ יַם־סֽוּף",
      [
        { grapheme: "בִּןנוּן֙".normalize("NFC"), phoneme: "bin.ˈnun" },
        { grapheme: "יַםסֽוּף".normalize("NFC"), phoneme: "jam.ˈsuf" }
      ]
    ),
    "בִּןנוּן֙ יַםסֽוּף".normalize("NFC")
  );
  assert.equal(speech.vocalizedHebrewOnly("English שלום שּׁ 42"), "");
});

test("keeps recognized unvocalized words while omitting unknown ones", () => {
  const known = [{ grapheme: "יהוה", phoneme: "a.do.ˈnaj" }];
  assert.equal(
    speech.speakableHebrewOnly("English יהוה שלום בָּרוּךְ", known),
    "יהוה בָּרוּךְ".normalize("NFC")
  );
});

test("converts stressed transliteration to Azure Hebrew IPA", () => {
  assert.equal(speech.ipaFromTransliteration("barúkh"), "ba.ˈʁux");
  assert.equal(speech.ipaFromTransliteration("she'amár"), "ʃe.ʔa.ˈmaʁ");
  assert.equal(speech.ipaFromTransliteration("Elohéinu"), "e.lo.ˈhej.nu");
  assert.equal(speech.ipaFromTransliteration("meshubáḥ"), "me.ʃu.ˈbax");
});

test("classifies only unchanged imported text as Sefaria audio", () => {
  const imported = "שְׁמַע יִשְׂרָאֵל";
  assert.equal(speech.audioSourceType("4. שְׁמַע יִשְׂרָאֵל", imported), "sefaria");
  assert.equal(speech.audioSourceType("שְׁמַע יִשְׂרָאֵל!", imported), "arbitrary");
  assert.equal(speech.audioSourceType(imported, ""), "arbitrary");
});
