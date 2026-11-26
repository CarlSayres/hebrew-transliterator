const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTransliterator } = require("../scripts/genesis-audit");
const speech = require("../site/speech");

const runtime = loadTransliterator();
const Transliterator = runtime.HebrewTransliterator.Transliterator;
const styles = runtime.HebrewRulesets.all.map(style => new Transliterator(style));
const voice = new Transliterator(speech.speechRuleset(runtime.HebrewRulesets.speechEnglish, "e"));
const spoken = input => speech.prepareAzureHebrew(input, voice);
const adonai = "אֲדֹנָי".normalize("NFC");
const elohim = "אֱלֹהִים".normalize("NFC");

test("Adonai paired with the tetragrammaton reads Adonai Elohim in both written orders", () => {
  for (const source of [
    "אֲדֹנָ֤י יֱהֹוִה֙", // Genesis 15:2
    "יֱהֹוִ֤ה אֲדֹנָי֙", // Habakkuk 3:19
    "אדני יהוה", "יהוה אדני", "י״י אֲדֹנָי", "אֲדֹנָי ה׳"
  ]) {
    for (const t of styles) {
      const aligned = t.transliterateWithAlignment(source);
      assert.equal(aligned.text, "Adonai Elohim", source);
      assert.equal(t.transliterateWithStressMarks(source), aligned.text, source);
      const [first, second] = aligned.segments;
      const selected = (segment) => ({
        start: segment.targetStart, end: segment.targetEnd
      });
      assert.equal(spoken(speech.sourceForTargetSelection(source, aligned.segments, selected(first))).text, adonai);
      const hebrew = speech.selectedOrAll(source, { start: second.sourceStart, end: second.sourceEnd }, aligned.segments);
      assert.equal(spoken(hebrew).text, elohim);
      assert.equal(spoken(speech.sourceForTargetSelection(source, aligned.segments, selected(second))).text, elohim);
    }
    assert.equal(spoken(source).text, adonai + " " + elohim);
    assert.deepEqual(spoken(source).lexicon.map(entry => entry.phoneme), ["a.do.ˈnaj", "e.lo.ˈhim"]);
  }
  assert.equal(styles[1].transliterate("אֲדֹנָי־יהוה"), "Adonai Elohim");
  assert.equal(spoken("אֲדֹנָי־יהוה").text, adonai + elohim);
  assert.equal(spoken("יֱהֹוִה").text, elohim);
  assert.equal(styles[1].transliterate("וְלֵיהֹוִ֥ה אֲדֹנָ֑י"), "V'ladonai Elohim");
});

test("the repeated Name in Exodus 34:6 and the secular adoni remain distinct", () => {
  const excerpt = "יְהֹוָ֣ה ׀ יְהֹוָ֔ה אֵ֥ל"; // Exodus 34:6, the Thirteen Attributes
  for (const t of styles) {
    assert.equal(t.transliterate(excerpt).replace(/\s+/gu, " "), "Adonai Adonai El");
    assert.equal(t.transliterate("אֲדֹנָי אֲדֹנָי"), "Adonai Adonai");
    assert.doesNotMatch(t.transliterate("יְהֹוָה֙ אֲדֹנִ֣י"), /Elohim/); // 1 Samuel 25:28
  }
  assert.equal(spoken(excerpt).text, adonai + " " + adonai + " " + "אֵ֥ל".normalize("NFC"));
  assert.equal(spoken("ה׳ ה׳").text, adonai + " " + adonai);
  assert.doesNotMatch(spoken("יְהֹוָה֙ אֲדֹנִ֣י").text, /אֱל/u);
});

test("stacked prefixes keep the reading of the Name, while an interrogative he stays ha", () => {
  for (const [input, levShalem, ipa] of [
    ["וּבַיהֹוָ֥ה", "U-vadonai", "u.va.do.ˈnaj"], // Psalm 26:1
    ["וּבַה׳", "U-vadonai", "u.va.do.ˈnaj"],
    ["וְלַֽיהוָ֖ה", "V'ladonai", "ve.la.do.ˈnaj"], // Joshua 22:24
    ["הַֽיהֹוָה֙", "Ha-Adonai", "ha.ʔa.do.ˈnaj"], // Jeremiah 8:19
    ["הַ", "Ha", "ˈha"], ["הֲ", "Ha", "ˈha"]
  ]) {
    assert.equal(styles[1].transliterate(input), levShalem);
    assert.equal(spoken(input).lexicon[0].phoneme, ipa);
    assert.equal(styles[1].unvocalizedWords(input).length, 0);
  }
  const ha = spoken("הַ לְיְהֹוָה֙").lexicon.map(entry => entry.phoneme); // Deuteronomy 32:6
  assert.deepEqual(ha, ["ˈha", "la.do.ˈnaj"]);
  assert.equal(spoken("ה").text, adonai);
});
