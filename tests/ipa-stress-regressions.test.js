const assert = require("node:assert/strict");
const test = require("node:test");
const speech = require("../site/speech");
const { loadTransliterator } = require("../scripts/genesis-audit");

const { HebrewTransliterator, HebrewRulesets } = loadTransliterator();
const audio = new HebrewTransliterator.Transliterator(speech.speechRuleset(HebrewRulesets.speechEnglish, "e"));
const ipa = text => speech.prepareAzureHebrew(text, audio).lexicon.map(entry => entry.phoneme);

test("IPA preserves consonant identities across Hebrew letters", () => {
  for (const [word, expected] of [
    ["וַיַּקְהֵ֣ל", "va.jak.ˈhel"], // Exodus 35:1: qof + he
    ["יִשְׂחָ֔ק", "jis.ˈxak"], // Amos 7:9: sin + chet
    ["פַּתְשֶׁ֣גֶן", "pat.ˈʃe.gen"], // Esther 3:14: tav + shin
    ["שָׁלוֹם", "ʃa.ˈlom"], ["צַו", "ˈt͡sav"], ["לָךְ", "ˈlax"]
  ]) {
    assert.deepEqual(ipa(word), [expected], word);
  }
});

test("unaccented common words use attested lexical stress; explicit accents take precedence", () => {
  for (const [word, accented, expected] of [
    ["מֶלֶךְ", "מֶ֣לֶךְ", "ˈme.lex"],
    ["חֶסֶד", "חֶ֖סֶד", "ˈxe.sed"],
    ["בֹּקֶר", "בֹּ֔קֶר", "ˈbo.keʁ"],
    ["אֲנַחְנוּ", "אֲנַ֨חְנוּ", "ʔa.ˈnax.nu"],
    ["יְרוּשָׁלַיִם", "יְרוּשָׁלַ֖יִם", "je.ʁu.ʃa.ˈla.jim"]
  ]) {
    assert.deepEqual(ipa(word), [expected]);
    assert.deepEqual(ipa(word), ipa(accented));
  }
  assert.deepEqual(ipa("מֶלֶ֣ךְ"), ["me.ˈlex"]);
});

test("lone dehi leaves lexical stress and congregational shva intact", () => {
  for (const [word, expected] of [
    ["אֲ֭נִי", "ʔa.ˈni"], ["הַ֭מֶּלֶךְ", "ha.ˈme.lex"], ["מִ֭צְרַיִם", "mit͡s.ˈʁa.jim"],
    ["יְ֭רוּשָׁלָ͏ִם", "je.ʁu.ʃa.ˈla.jim"], ["וּ֭שְׁמַע", "uʃ.ˈma"],
    ["פִּֽ֭ינְחָס", "pi.ne.ˈxas"], ["מִ֭צְוֹתֶיךָ", "mit͡s.vo.ˈte.xa"]
  ]) assert.deepEqual(ipa(word), [expected], word);
  assert.deepEqual(ipa("הַ֭מֶּלֶ֭ךְ"), ["ha.me.ˈlex"]); // A second dehi is a stress helper.
});

test("verse-final silluq outranks earlier meteg, including in maqaf groups", () => {
  for (const [verseFinal, expected] of [
    ["יִֽהְיֽוּ׃", "jih.ˈju"], ["וִֽחְיֽוּ׃", "vix.ˈju"], ["אֶת־יִֽהְיֽוּ׃", "ʔet.jih.ˈju"]
  ]) {
    assert.deepEqual(ipa(verseFinal), [expected]);
    assert.match(audio.transliterateWithAllStressMarks(verseFinal, { primaryOnly: true }), /u\u0301:$/u);
  }
  // Outside a verse ending, keep the established meteg interpretation.
  assert.deepEqual(ipa("יִֽהְיֽוּ"), ["ˈjih.ju"]);
});

test("identical medial and verse-final spellings keep distinct IPA in one lexicon", () => {
  // I Samuel 11:9 and Ezekiel 18:20.
  const word = "תִּֽהְיֶֽה";
  for (const pair of [[word, word + "׃"], [word + "׃", word]]) {
    const prepared = speech.prepareAzureHebrew(pair.join(" "), audio);
    assert.deepEqual(prepared.lexicon.map(entry => entry.phoneme), pair.map(value => ipa(value)[0]));
    assert.equal(new Set(prepared.lexicon.map(entry => entry.grapheme)).size, 2);
    for (const entry of prepared.lexicon) assert.ok(prepared.text.includes(entry.grapheme));
  }
});

test("a maqaf group and its selected unstressed member keep the same kamatz", () => {
  const display = new HebrewTransliterator.Transliterator(HebrewRulesets.levShalem);
  for (const [ordinary, expected, first] of [
    ["כְּתָב־לְךָ֖", "ke.tov.le.ˈxa", "ke.ˈtov"],
    ["לֶאֱכָל־לֶ֛חֶם", "le.ʔe.xol.ˈle.xem", "le.ʔe.ˈxol"],
    ["חָק־עוֹלָ֔ם", "xok.ʔo.ˈlam", "ˈxok"]
  ]) {
    assert.deepEqual(ipa(ordinary), [expected]);
    assert.deepEqual(ipa(ordinary.replace("ָ", "ׇ")), [expected]);
    const { segments } = display.transliterateWithAlignment(ordinary);
    const word = segments[0];
    assert.deepEqual(ipa(speech.sourceForTargetSelection(ordinary, segments,
      { start: word.targetStart, end: word.targetEnd })), [first]);
    assert.deepEqual(ipa(speech.selectedOrAll(ordinary,
      { start: word.sourceStart, end: word.sourceEnd }, segments)), [first]);
    assert.equal(speech.selectedOrAll(ordinary, { start: 0, end: ordinary.length }, segments), ordinary);
  }
});

test("silent alef in a coda and consonantal alef at the start of a syllable", () => {
  for (const [input, expected] of [
    ["רֹאשׁ", "ˈʁoʃ"], ["זֹאת", "ˈzot"], ["וַיֹּ֣אמֶר", "va.ˈjo.meʁ"], ["קָרָאתִי", "ka.ˈʁa.ti"],
    ["יִרְאָה", "jiʁ.ˈʔa"], ["מֵאוֹר", "me.ˈʔoʁ"], ["בּוֹאוּ", "bo.ˈʔu"]
  ]) assert.deepEqual(ipa(input), [expected], input);
});

test("unaccented prayer words keep lexical stress and its effect on kamatz", () => {
  const display = new HebrewTransliterator.Transliterator(HebrewRulesets.levShalem);
  for (const [input, marked, expected] of [
    ["אֲנָחְנוּ", "אֲנָֽחְנוּ", "ʔa.ˈnax.nu"], ["אָתָּה", "אָ֑תָּה", "ˈʔa.ta"],
    ["עֶרֶב", "עֶ֣רֶב", "ˈʔe.ʁev"], ["אֲבוֹתֵינוּ", "אֲבוֹתֵ֖ינוּ", "ʔa.vo.ˈtej.nu"],
    ["אֱלוֹהַּ", "אֱל֣וֹהַּ", "e.ˈlo.ah"], ["בַּדֶּרֶךְ", "בַּדֶּ֔רֶךְ", "ba.ˈde.ʁex"]
  ]) {
    assert.deepEqual(ipa(input), [expected], input);
    assert.deepEqual(ipa(marked), [expected], marked);
    assert.equal(display.transliterateWithStressMarks(input), display.transliterateWithStressMarks(marked));
  }
  assert.deepEqual(ipa("עֶרֶ֣ב"), ["ʔe.ˈʁev"]);
  // Psalm 142:8 has an accent on the sh'va and another on the stressed mem.
  assert.deepEqual(ipa("שְׁ֫מֶ֥ךָ"), ["ʃe.ˈme.xa"]);
  assert.deepEqual(ipa("וּשְׁמָע"), ["uʃ.ˈma"]);
  assert.deepEqual(ipa("זָרַ֣ע זָ֑רַע"), ["za.ˈʁa", "ˈza.ʁa"]);
});
