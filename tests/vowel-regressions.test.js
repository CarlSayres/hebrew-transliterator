const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTransliterator } = require("../scripts/genesis-audit");
const speech = require("../site/speech");

const runtime = loadTransliterator();
const { Transliterator } = runtime.HebrewTransliterator;
const styles = runtime.HebrewRulesets.all.map(style => new Transliterator(style));
const speechEngine = new Transliterator(speech.speechRuleset(runtime.HebrewRulesets.speechEnglish, "e"));
const ipa = word => speech.prepareAzureHebrew(word, speechEngine).lexicon[0].phoneme;

test("double-pointed biblical Jerusalem supplies the same syllables and accents as the explicit yod", () => {
  for (const [source, plene] of [
    ["יְרוּשָׁלָֽ\u034fִם", "יְרוּשָׁלָֽיִם"],     // Psalm 122:2
    ["יְרוּשָׁלַ֖\u034fִם", "יְרוּשָׁלַ֖יִם"],     // Daniel 1:1
    ["וּמִירוּשָׁלִַ֖ם", "וּמִירוּשָׁלַ֖יִם"]     // Amos 1:2 without CGJ
  ]) {
    for (const style of styles) {
      assert.match(style.transliterate(source), /layim$/u);
      assert.equal(style.transliterateWithStressMarks(source), style.transliterateWithStressMarks(plene));
      const aligned = style.transliterateWithAlignment(source);
      assert.equal(aligned.segments[0].sourceEnd, source.length);
    }
    assert.equal(ipa(source), ipa(plene));
    assert.match(ipa(source), /ˈla\.jim$/u);
  }
  assert.match(styles[0].transliterate("יְרוּשְׁלֶם"), /lem$/u); // Aramaic Ezra 7:14
});

test("holam-vav preserves a previous vowel and consonantal vav", () => {
  for (const [source, control] of [
    ["עָוֹן", "עָוֺן"], ["עֲוֹנוֹת", "עֲוֺנוֹת"], ["מִצְוֹתָיו", "מִצְוֺתָיו"],
    ["מֵאוֹת֙", "מֵאֹת֙"], ["מֵאוֹר", "מֵאֹר"], ["נֵאוֹת", "נֵאֹת"]
  ]) {
    for (const style of styles) {
      assert.equal(style.transliterateWithAllStressMarks(source), style.transliterateWithAllStressMarks(control));
    }
    assert.equal(ipa(source), ipa(control));
  }
  assert.equal(ipa("מֵאוֹת֙"), "me.ˈʔot");
  assert.equal(ipa("עָוֹן"), "ʔa.ˈvon");
  assert.equal(styles[0].transliterate("וּלְצַוּ֣וֹת"), "Ul·tzavot");
  assert.equal(ipa("וּלְצַוּ֣וֹת"), "ul.t͡sa.ˈvot");
  assert.equal(styles[0].transliterate("הַוּ֥וֹת"), "Havot");
  assert.equal(ipa("גּוֹזֵר"), "go.ˈzeʁ");
  assert.equal(styles[0].transliterate("עֲשׂוֹת"), "Asot");
});

test("final yod-vav preserves a yod with its own vowel", () => {
  for (const [source, plene] of [
    ["לְחָיָו֙", "לְחָיָי֙ו"], ["וּפְדוּיָו֙", "וּפְדוּיָי֙ו"], ["מִדָּלְיָ֔ו", "מִדָּלְיָ֔יו"]
  ]) {
    for (const style of styles) {
      assert.match(style.transliterate(source), /yav$/u);
      assert.equal(style.transliterate(source), style.transliterate(plene));
    }
    assert.match(ipa(source), /ˈjav$/u);
  }
  for (const style of styles) {
    assert.equal(style.transliterate("זִיו"), "Ziv");
    assert.equal(style.transliterate("עָלָיו"), "Alav");
  }
});

test("Daniel's attested zīwōhī keeps its consonantal vav with either holam spelling", () => {
  for (const [source, expected] of [
    ["זִיוֹ֣הִי", "zi.ˈvo.hi"], ["וְזִיוֹ֖הִי", "ve.zi.ˈvo.hi"]
  ]) {
    const mam = source.replace("ֹ", "ֺ");
    for (const style of styles) {
      assert.equal(style.transliterateWithStressMarks(source), style.transliterateWithStressMarks(mam));
      assert.match(style.transliterate(source), /zivohi$/iu);
    }
    assert.equal(ipa(source), expected);
    assert.equal(ipa(mam), expected);
    assert.equal(ipa(source.replace(/[\u0591-\u05ae]/gu, "")), expected);
  }
  // Ordinary holam-vav after a yod can also spell yo, as in arayot.
  assert.match(styles[0].transliterate("אֲרָיוֹת"), /ayot$/u);
});
