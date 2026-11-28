const assert = require("node:assert/strict");
const test = require("node:test");
const { loadTransliterator } = require("../scripts/genesis-audit");
const speech = require("../site/speech");

const { HebrewRulesets, HebrewTransliterator } = loadTransliterator();
const { Transliterator } = HebrewTransliterator;
const audio = new Transliterator(speech.speechRuleset(HebrewRulesets.speechEnglish, "e"));

test("lexical initials keep their stems together, and internal dagesh can double", () => {
  const style = HebrewRulesets.levShalem;
  const single = new Transliterator(style);
  const doubled = new Transliterator({ ...style, output: { ...style.output, doubleDageshChazak: true } });
  for (const [word, plain, geminated] of [
    ["הַר", "Har", "Har"], ["לֶחֶם", "Leḥem", "Leḥem"],
    ["כִּסֵּא", "Kisei", "Kissei"], ["כִּפּוּר", "Kipur", "Kippur"],
    ["כִּפֻּרִים", "Kipurim", "Kippurim"], ["בִּכּוּרֵי", "Bikurei", "Bikkurei"],
    ["לִבִּ֥י", "Libi", "Libbi"], ["לִבָּהּ", "Libah", "Libbah"],
    ["לַמְּדֵנִי", "Lam'deini", "Lamm'deini"], ["בָּתֵּינוּ", "Bateinu", "Batteinu"],
    ["מֵאוֹת", "Mei·ot", "Mei·ot"], ["מֵאֹת", "Mei·ot", "Mei·ot"],
    // Actual preposition + article combinations retain their formatting.
    ["לַמֶּלֶךְ", "La-melekh", "La-melekh"], ["בַּיּוֹם", "Ba-yom", "Ba-yom"]
  ]) {
    assert.equal(single.transliterate(word), plain, word);
    assert.equal(doubled.transliterate(word), geminated, word);
  }
  for (const [word, expected] of [["לִבִּי", "Libbi"], ["בִּכּוּרִים", "Bikkurim"]]) {
    for (const style of HebrewRulesets.all) {
      const t = new Transliterator({ ...style, output: { ...style.output, doubleDageshChazak: true } });
      assert.equal(t.transliterate(word), expected);
    }
  }
});

test("the vowel encoding of kol cannot change its kaf or its prefix", () => {
  for (const style of HebrewRulesets.all) {
    const t = new Transliterator(style);
    for (const pref of ["", "בְּ", "וְ", "מִ", "וּבְ", "שֶׁבְּ"]) {
      for (const [kaf, sound] of [["כ", style.consonants["כ"].plain], ["כּ", "k"]]) {
        const ordinary = pref + kaf + "ָל";
        const qatan = pref + kaf + "ׇל";
        const result = t.transliterate(qatan);
        assert.equal(t.transliterate(ordinary), result, ordinary);
        assert.ok(result.toLowerCase().endsWith(sound + "ol"), result);
        const expectedIPA = kaf === "כ" ? "xol" : "kol";
        for (const word of [ordinary, qatan]) {
          assert.ok(speech.prepareAzureHebrew(word, audio).lexicon[0].phoneme.endsWith(expectedIPA), word);
        }
      }
    }
  }
});

test("unknown unpointed medial-vav words are preserved and omitted from audio", () => {
  const t = new Transliterator(HebrewRulesets.levShalem);
  const unknown = "קום רוח שוב";
  assert.equal(t.transliterate(unknown), unknown);
  assert.deepEqual(Array.from(t.unvocalizedWords(unknown)), unknown.split(" "));
  assert.deepEqual(speech.prepareAzureHebrew(unknown, audio), { text: "", lexicon: [] });
  const mixed = "אור סוף הוד " + unknown + " קוּם";
  assert.equal(t.transliterate(mixed), "Or sof hod " + unknown + " kum");
  assert.deepEqual(speech.prepareAzureHebrew(mixed, audio).lexicon.map(entry => entry.phoneme),
    ["ˈoʁ", "ˈsof", "ˈhod", "ˈkum"]);
});

test("the Torah's feminine pronoun keeps its reading under prefixes", () => {
  for (const style of HebrewRulesets.all) {
    const t = new Transliterator(style);
    for (const [oldSpelling, standard] of [["וְהִ֣וא", "וְהִ֣יא"], ["וְהִוא", "וְהִיא"], ["הִ֣וא", "הִ֣יא"]]) {
      assert.equal(t.transliterate(oldSpelling), t.transliterate(standard));
      assert.equal(speech.prepareAzureHebrew(oldSpelling, audio).lexicon[0].phoneme,
        speech.prepareAzureHebrew(standard, audio).lexicon[0].phoneme);
    }
  }
  assert.equal(speech.prepareAzureHebrew("וְהוּא", audio).lexicon[0].phoneme, "ve.ˈhu");
});

test("Issachar keeps the silent second shin when prefixed", () => {
  for (const style of HebrewRulesets.all) {
    const t = new Transliterator(style);
    const name = t.transliterate("יִשָּׂשכָר").toLowerCase();
    for (const prefix of ["וְ", "בְּ", "לְ", "וּלְ"]) {
      const word = prefix + "יִשָּׂשכָ֖ר";
      assert.ok(t.transliterate(word).toLowerCase().endsWith(name), word);
      assert.match(speech.prepareAzureHebrew(word, audio).lexicon[0].phoneme, /jis\.sa\.ˈxaʁ$/u);
    }
  }
});

test("lexical initials, the definite article, and the suffixed infinitive molkho", () => {
  const t = new Transliterator(HebrewRulesets.levShalem);
  for (const [word, expected] of [
    ["לַחְמָם", "Laḥmam"], ["מִיכָה", "Mikhah"], ["מִדָּה", "Midah"],
    ["בָּהּ", "Bah"], ["מִכֹּל", "Mi-kol"], ["הָאִישׁ", "Ha-ish"],
    ["הָעִיר", "Ha-ir"], ["הָעִירָה", "Ha·irah"], ["הָעֵד", "Ha·eid"],
    ["בְּמָלְכ֜וֹ", "B'molkho"], ["בְמָלְכוֹ", "V'molkho"], ["לְמָלְכוֹ", "L'molkho"]
  ]) assert.equal(t.transliterate(word), expected, word);
  assert.equal(speech.prepareAzureHebrew("לַחְמָם", audio).lexicon[0].phoneme, "lax.ˈmam");
  assert.equal(speech.prepareAzureHebrew("בְּמָלְכ֜וֹ", audio).lexicon[0].phoneme, "be.mol.ˈxo");
});
