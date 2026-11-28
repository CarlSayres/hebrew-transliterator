const test = require("node:test");
const assert = require("node:assert/strict");
const speech = require("../site/speech");

test("MAM ketiv and qere stay visible but only the qere enters speech, including selections", () => {
  const { HebrewTransliterator, HebrewRulesets } = require("../scripts/genesis-audit").loadTransliterator();
  const display = new HebrewTransliterator.Transliterator(HebrewRulesets.levShalem);
  const voice = new HebrewTransliterator.Transliterator(speech.speechRuleset(HebrewRulesets.speechEnglish, "e"));
  const say = text => speech.prepareAzureHebrew(text, voice);
  for (const [written, read] of [["לא", "ל֥וֹ"], ["לא", "ל֣וּ"], ["כי טוב", "כְּט֣וֹב"], ["או", "אֵ֣י"]]) {
    const source = require("../site/sefaria-client").cleanText(
      `<span class="mam-kq-k">(${written})</span> <span class="mam-kq-q">[${read}]</span>`
    );
    const { text, segments } = display.transliterateWithAlignment(source);
    assert.match(text, /\(.+\) \[.+\]/u);
    assert.deepEqual(say(source), say(read));
    const end = source.indexOf(")");
    assert.equal(speech.selectedOrAll(source, { start: 1, end }, segments), "");
    assert.equal(speech.sourceForTargetSelection(source, segments, {
      start: segments[0].targetStart, end: segments[0].targetEnd
    }), "");
    assert.deepEqual(say(speech.selectedOrAll(source, { start: end - 1, end: source.length }, segments)), say(read));
  }
  assert.deepEqual(say("(לא) [לוֹ־]מֶלֶךְ"), say("לוֹ־מֶלֶךְ"));
  assert.deepEqual(say("(בָּרוּךְ) [אַתָּה]"), say("בָּרוּךְ אַתָּה"));
});

test("selecting a complete verse-final word keeps its silluq in speech", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const t = new engine.HebrewTransliterator.Transliterator(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, "e"));
  const source = "הֵם יִֽהְיֽוּ׃";
  const { segments } = t.transliterateWithAlignment(source);
  const last = segments.at(-1);
  const fromHebrew = speech.selectedOrAll(source, { start: last.sourceStart, end: last.sourceEnd }, segments);
  const fromLatin = speech.sourceForTargetSelection(source, segments, { start: last.targetStart, end: last.targetEnd });
  assert.equal(fromHebrew, "יִֽהְיֽוּ׃");
  assert.equal(fromLatin, fromHebrew);
  assert.equal(speech.prepareAzureHebrew(fromHebrew, t).lexicon[0].phoneme, "jih.ˈju");
});

test("the IPA stresses the trope when the same word also has a secondary meteg", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const t = new engine.HebrewTransliterator.Transliterator(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, "e"));
  for (const [word, expected] of [
    ["תַּֽדְשֵׁ֤א", "tad.ˈʃe"], ["הַֽחַיָּ֣ה", "ha.xa.ˈja"], ["לָֽרָקִ֖יעַ", "la.ʁa.ˈki.a"]
  ]) {
    assert.equal(speech.prepareAzureHebrew(word, t).lexicon[0].phoneme, expected, word);
  }
  assert.equal(t.transliterateWithAllStressMarks("תַּֽדְשֵׁ֤א").match(/\u0301/gu).length, 2);
  // With no primary trope, the meteg can still supply stress.
  assert.equal(speech.prepareAzureHebrew("לָנֶֽצַח", t).lexicon[0].phoneme, "la.ˈne.t͡sax");
});

test("secondary meteg preserves primary audio stress across the Genesis fixture", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const t = new engine.HebrewTransliterator.Transliterator(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, "e"));
  const displayIPA = word => speech.ipaFromTransliteration(t.transliterateWithAllStressMarks(word));
  const spokenIPA = word => speech.prepareAzureHebrew(word, t).lexicon[0].phoneme;
  const withoutStress = ipa => ipa.replace(/[ˈˌ]/gu, "");
  for (const chapter of require("./fixtures/genesis/source.json").chapters) {
    for (const verse of chapter.verses) {
      for (const word of verse.hebrew.match(/[א-ת][א-ת\p{M}]*/gu) || []) {
        if (!word.includes("\u05bd") || !/[\u0591-\u05ae]/u.test(word)) continue;
        const withoutMeteg = word.replace(/\u05bd/gu, "");
        const marked = displayIPA(word), unmarked = displayIPA(withoutMeteg);
        // Some metegs affect the vowel itself. Compare only a difference in stress.
        if (marked !== unmarked && withoutStress(marked) === withoutStress(unmarked)) {
          assert.equal(spokenIPA(word), spokenIPA(withoutMeteg), "Genesis " + chapter.chapter + ":" + verse.verse + " " + word);
        }
      }
    }
  }
});

test("abbreviated names with prefixes match the full reading, speech and selection", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const Trans = engine.HebrewTransliterator.Transliterator;
  for (const tzere of ["e", "ei"]) {
    const audio = new Trans(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, tzere));
    for (const style of engine.HebrewRulesets.all) {
      const t = new Trans({ ...style, vowels: { ...style.vowels, tzere } });
      for (const prefix of ["", "בַּ", "כַּ", "לַ", "וַ", "מֵ", "וּמֵ", "שֶׁ"]) {
        const full = prefix + "יהוה";
        for (const short of ["ה׳", "ה'", "ה’", "יְיָ", "יי", "י״י", 'י"י']) {
          const word = prefix + short;
          const source = "🙏 " + word + "!";
          const aligned = t.transliterateWithAlignment(source);
          assert.equal(aligned.text, t.transliterate("🙏 " + full + "!"), word);
          const [segment] = aligned.segments;
          assert.equal(source.slice(segment.sourceStart, segment.sourceEnd), word);
          assert.equal(t.unvocalizedWords(word).length, 0);
          assert.deepEqual(speech.prepareAzureHebrew(word, audio), speech.prepareAzureHebrew(full, audio), word);
        }
      }
      for (const other of ["בָּהּ", "חַיַּי", "חַיִּים", "הַבַּיִת", "ב״ה", "הקב״ה"]) {
        assert.equal(t.expandDivineNameAbbreviations(other), other);
      }
    }
  }
});

test("sentence capitalization preserves literal English, links and Unicode spelling", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const t = new engine.HebrewTransliterator.Transliterator(engine.HebrewRulesets.modernSefardi);
  const latin = "iPhone https://example.org/file.name. café. e\u0301lan.";
  const source = latin + " שָׁלוֹם: iPad.\nשָׁלוֹם";
  const expected = latin + " Shalom: iPad.\nShalom";
  const aligned = t.transliterateWithAlignment(source);
  assert.equal(t.transliterate(source), expected);
  assert.equal(t.transliterateWithStressMarks(source), expected);
  assert.equal(aligned.text, expected);
  for (const segment of aligned.segments) {
    assert.equal(source.slice(segment.sourceStart, segment.sourceEnd), "שָׁלוֹם");
    assert.equal(aligned.text.slice(segment.targetStart, segment.targetEnd), "Shalom");
  }
});

test("English cues and their punctuation are omitted while passage punctuation survives", () => {
  const first = "שָׁלוֹם", second = "עֲלֵיכֶם";
  for (const cue of ["(repeat 2–4 times!)", "[pp. 10–12]", "repeat 2–4 times!"]) {
    const source = first + ", " + cue + " " + second + "׃";
    assert.equal(speech.speakableHebrewOnly(source), (first + ", " + second + "׃").normalize("NFC"));
  }
  assert.equal(speech.speakableHebrewOnly(first + " (repeat!), " + second), (first + ", " + second).normalize("NFC"));
  assert.equal(speech.speakableHebrewOnly("(sing " + first + "!)"), (first + "!").normalize("NFC"));
});

test("the vav-prefixed divine name is Vadonai in every style and in the speech lexicon", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const Trans = engine.HebrewTransliterator.Transliterator;
  const audio = new Trans(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, "e"));
  const fixture = require("./fixtures/genesis/source.json");
  const words = fixture.chapters.flatMap(chapter => chapter.verses.flatMap(verse =>
    Array.from(verse.hebrew.matchAll(/[א-ת][א-ת\p{M}]*/gu), match => match[0])
      .filter(word => word.replace(/\p{M}/gu, "") === "ויהוה")));
  assert.equal(words.length, 7);
  for (const word of [...words, "ויהוה"]) {
    for (const style of engine.HebrewRulesets.all) {
      assert.equal(new Trans(style).transliterate(word), "Vadonai");
    }
    assert.equal(speech.prepareAzureHebrew(word, audio).lexicon[0].phoneme, "va.do.ˈnaj");
  }
});

test("mem-prefixed divine names keep their style and tzere with any subset of points", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const Trans = engine.HebrewTransliterator.Transliterator;
  for (const tzere of ["e", "ei"]) {
    const prefix = "m" + tzere;
    const audio = new Trans(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, tzere));
    for (const style of engine.HebrewRulesets.all) {
      const t = new Trans({ ...style, vowels: { ...style.vowels, tzere } });
      const modern = style.id === "modernSefardi";
      for (const word of ["מֵיְהֹוָ֖ה", "וּמֵיְהֹוָה"]) {
        const withVav = word.startsWith("ו");
        const reading = (withVav ? (modern ? "u" : "u-") : "") + prefix + (modern ? "·" : "-") + "Adonai";
        const expected = reading[0].toUpperCase() + reading.slice(1);
        const ipa = (withVav ? "u." : "") + (tzere === "e" ? "me" : "mej") + ".ʔa.do.ˈnaj";
        let variants = [""];
        for (const char of word) {
          const withChar = variants.map(value => value + char);
          variants = /\p{M}/u.test(char) ? variants.concat(withChar) : withChar;
        }
        for (const variant of variants) {
          assert.equal(t.transliterateWithAlignment(variant).text, expected, variant);
          assert.equal(t.transliterateWithStressMarks(variant), expected, variant);
          assert.equal(t.unvocalizedWords(variant).length, 0, variant);
          assert.equal(speech.prepareAzureHebrew(variant, audio).lexicon[0].phoneme, ipa, variant);
        }
      }
    }
  }
});

test("IPA respects Hebrew stress on spelling exceptions and before furtive patach", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const audio = new engine.HebrewTransliterator.Transliterator(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, "e"));
  for (const [word, expected] of [
    ["לָ֑יְלָה", "ˈlaj.la"], ["לָיְלָה", "ˈlaj.la"], ["שְׁתַּ֥יִם", "ˈʃta.jim"],
    ["רוּחַ", "ˈʁu.ax"], ["כֹּחַ", "ˈko.ax"], ["מָשִׁיחַ", "ma.ˈʃi.ax"],
    ["גָּבוֹהַּ", "ga.ˈvo.ah"]
  ]) {
    assert.equal(speech.prepareAzureHebrew(word, audio).lexicon[0].phoneme, expected, word);
  }
});

test("presentation forms preserve spelling and original selection offsets", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  for (const style of engine.HebrewRulesets.all) {
    const t = new engine.HebrewTransliterator.Transliterator(style);
    const text = "שָׁלוֹם בָּרוּךְ";
    const result = t.transliterateWithAlignment(text);
    assert.equal(result.text, t.transliterate(text.normalize("NFD")));
    assert.deepEqual(Array.from(result.segments, s => text.slice(s.sourceStart, s.sourceEnd)), text.split(" "));
  }
});

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
  assert.equal(eRuleset.exceptions.exactWords.word, "Eloheinu");
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

test("prepares the entire marked word from Genesis 35:22 for Azure", () => {
  const { loadTransliterator } = require("../scripts/genesis-audit");
  const engine = loadTransliterator();
  const t = new engine.HebrewTransliterator.Transliterator(speech.speechRuleset(engine.HebrewRulesets.speechEnglish, "e"));
  const verses = require("./fixtures/genesis/source.json").chapters[34].verses;
  const word = verses[21].hebrew.split(/\s+/u).find((token) => token.includes("\u034f"));
  const prepared = speech.prepareAzureHebrew(word, t);
  assert.equal(prepared.lexicon.length, 1);
  assert.match(prepared.lexicon[0].grapheme, /ל$/u);
  assert.match(prepared.lexicon[0].phoneme, /el$/u);
  assert.deepEqual(prepared, speech.prepareAzureHebrew(word.replace("\u034f", ""), t));

  const prepare = (text) => speech.prepareAzureHebrew(text, t);
  assert.match(prepare("אֱלֹהֵינוּ").lexicon[0].phoneme, /hej/);
  assert.match(prepare("בֵּן").lexicon[0].phoneme, /ben/);
  assert.equal(prepare("י״י").text, prepare("יי").text);
  assert.equal(prepare('י"י').text, prepare("ה׳").text);
  assert.equal(prepare("הקב״ה").text, prepare("הַקָּדוֹשׁ בָּרוּךְ הוּא").text);
  assert.equal(prepare("ב״ה").text, "");
});

test("distinguishes an unmatched selection from no selection, including beside a divine name", () => {
  const engine = require("../scripts/genesis-audit").loadTransliterator();
  const t = new engine.HebrewTransliterator.Transliterator(engine.HebrewRulesets.levShalem);
  for (const source of ["ה׳ hello", "hello ׳ה", "לַה׳ hello", "שָׁלוֹם hello"]) {
    const { text, segments } = t.transliterateWithAlignment(source);
    const start = text.toLowerCase().indexOf("hello");
    assert.equal(speech.sourceForTargetSelection(source, segments, { start, end: start + 5 }), "");
    assert.equal(speech.sourceForTargetSelection(source, segments, { start, end: start }), null);
  }
});
