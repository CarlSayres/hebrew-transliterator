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
