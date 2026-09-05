const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTransliterator } = require("../scripts/genesis-audit");
const speech = require("../site/speech");

const window = loadTransliterator();
const { Transliterator, internals } = window.HebrewTransliterator;
const rules = window.HebrewRulesets.all.find((r) => r.id === "levShalem");
const engine = new Transliterator(rules);

function checkCases(cases) {
  for (const [input, expected] of cases) {
    for (const normalization of ["NFC", "NFD"]) {
      assert.equal(engine.transliterate(input.normalize(normalization)), expected, input);
    }
  }
}

test("reviewed amru family has vocal sh'va, independently of MAM gadol evidence", () => {
  checkCases([
    ["אָמְרוּ", "Am'ru"], ["אָֽמְרוּ", "Am'ru"],
    ["אָֽמְר֔וּ", "Am'ru"], ["וְאָמְרוּ", "V'am'ru"],
    ["שֶׁאָמְרוּ", "She-am'ru"], ["שֶׁאָֽמְרוּ", "She-am'ru"],
    ["וְשֶׁאָמְרוּ", "V'she-am'ru"]
  ]);
});

test("recognized she uses only explicitly reviewed inherited evidence", () => {
  checkCases([
    ["שֶׁבָּטְחוּ", "She-bat'ḥu"],
    ["וְשֶׁבָּטְחוּ", "V'she-bat·ḥu"],
    ["שֶׁחָכְמָה", "She-ḥokhmah"], ["שֶׁכָּל", "She-kol"],
    ["שֶׁאׇמְרוּ", "She-omru"], ["וְשֶׁלֶג", "V'sheleg"]
  ]);
  // Lexical classification must block inheritance even if the remainder
  // happens to occur in the gadol table.
  const clusters = internals.parseClusters("שֶׁאָמְרוּ");
  clusters[0].lexicalInitialShe = true;
  internals.applyForcedKamatzGadol(clusters, "שֶׁאָמְרוּ", rules);
  assert.ok(!clusters[1].forceKamatzGadol);
  // Explicit katan stays authoritative even if a table entry targets it.
  const katan = "שֶׁאׇמְרוּ";
  const explicit = internals.parseClusters(katan);
  const testRules = { ...rules, exceptions: { ...rules.exceptions,
    forcedKamatzGadol: { [katan.normalize("NFD")]: [1] }
  } };
  internals.applyForcedKamatzGadol(explicit, katan, testRules);
  assert.ok(!explicit[1].forceKamatzGadol);
});

test("hiriq prefixes distinguish reviewed lexical forms from true prefixes", () => {
  checkCases([
    ["מִתְנַשְּׂאִים", "Mitnas'im"],
    ["מִשְׁפְּחוֹתֵיהֶם", "Mishp'ḥoteihem"],
    ["בִמְנוּחָתֵנוּ", "Vimnuḥateinu"],
    ["בִגְדֵיהֶם", "Vigdeihem"],
    ["מִלְמָעְלָה", "Mi-l'molah"],
    ["מִשְׁמַנֵּי", "Mi-sh'manei"]
  ]);
});

test("lexical he forms do not masquerade as the article", () => {
  checkCases([
    ["הַזְכָּרַת", "Hazkarat"], ["הַגְבָּהַת", "Hagbahat"],
    ["הַכְנָסַת", "Hakhnasat"], ["הַשְׁכִּיבֵנוּ", "Hashkiveinu"],
    ["הַסְתִּירֵם", "Hastireim"], ["הַנְחִילֵנוּ", "Hanḥileinu"],
    ["הַמְרַחֵם", "Ha-m'raḥeim"]
  ]);
});

test("siddur-only silent sh'va decisions stay narrow", () => {
  checkCases([
    ["אוּקִימְנָא", "Ukimna"], ["אֹהַבְךָ", "Ohavkha"],
    ["תַּחְגֹּרְנָה", "Taḥgornah"], ["נַחֲלַתְכֶם", "Naḥalatkhem"],
    ["יִשָּׂאוּנְךָ", "Yisa·unkha"], ["לַחְפֹּר", "Laḥpor"],
    ["בַּרְתּוֹתָא", "Bartota"]
  ]);
});

test("final letter forms participate in the identical-letter rule", () => {
  checkCases([
    ["וְנַמְלִיכְךָ", "V'namlikh'kha"],
    ["יְבָרֶכְךָ", "Y'varekh'kha"]
  ]);
});

test("qamatz before vav-sh'va forms a closed av syllable", () => {
  checkCases([["הַמָּוְתָה", "Ha-movtah"]]);
});

test("a lone sin dot can also supply holam haser", () => {
  checkCases([
    ["וַיֶּחֱשׂף", "Vayeḥesof"],
    ["שׂנֵא", "Sonei"],
    ["שׂבַע", "Sova"],
    ["לַעֲשׂת", "La-asot"],
    ["שַׂר", "Sar"],
    ["יִשְׂרָאֵל", "Yisra·eil"],
    ["עָשׂוּ", "Asu"],
    ["תָּפַשׂ", "Tafas"]
  ]);
});

test("incomplete suffix shapes do not crash sh'va classification", () => {
  assert.doesNotThrow(() => engine.transliterate("אָבְנְ"));
});

test("reviewed missing-meteg forms retain gadol plus vocal sh'va", () => {
  checkCases([
    ["יָדְעוּ", "Yad'u"], ["שָׁמְעוּ", "Sham'u"],
    ["מָלְאָה", "Mal'ah"], ["קָפְאוּ", "Kaf'u"],
    ["וְיִכָּנְסוּ", "V'yikan'su"], ["דְּעָסְקִין", "D'as'kin"]
  ]);
});

test("siddur Aramaic can supply kamatz evidence without changing sh'va", () => {
  checkCases([["עָלְמִין", "Almin"]]);
});

test("patach before bet and chem/chen does not trigger the vocal suffix shortcut", () => {
  checkCases([
    ["לְבַבְכֶם", "L'vavkhem"], ["לְבַבְכֶ֖ם", "L'vavkhem"],
    ["לְבַבְכֶן", "L'vavkhen"], ["בִּלְבַבְכֶם", "Bilvavkhem"],
    ["לְבָבְכֶם", "L'vav'khem"], ["לְבָבְךָ", "L'vav'kha"],
    ["לְבַבְךָ", "L'vav'kha"], ["לְבַבְּכֶם", "L'vab'khem"],
    ["אֲנַחְנוּ", "Anaḥnu"], ["אֲנָֽחְנוּ", "Anaḥnu"],
    ["דְּבַרְכֶם", "D'varkhem"]
  ]);
  // The suffix fallback must not override the earlier two-sh'vas rule.
  const clusters = internals.parseClusters("לְבְבְכֶם");
  internals.classifyShevas(clusters, rules);
  assert.equal(clusters[2].sheva, "vocal");
});

test("conjunctive vav preserves the article rule before mem", () => {
  checkCases([
    ["הַמְרַחֵם", "Ha-m'raḥeim"], ["וְהַמְרַחֵם", "V'ham'raḥeim"],
    ["וְהַמְשַׁלֵּם", "V'ham'shaleim"],
    ["וְהַמְכַוֵּן", "V'ham'khavein"], ["וְהַמְפֹאָר", "V'ham'fo·ar"],
    ["וְהַמְצֵא", "V'hamtzei"], ["וְהַמְשֵׁךְ", "V'hamsheikh"],
    ["וְהַמְנִיכָא", "V'hamnikha"],
    ["וְהַֽמְנִיכָ֤א", "V'hamnikha"], ["וְהַֽמְנִיכָ֥א", "V'hamnikha"]
  ]);
});

test("a yod with its own vowel is consonantal, not a hiriq mater", () => {
  checkCases([
    ["וְקִיַּמְתָּנוּ", "V'kiyamtanu"],
    ["וְקִיַּמְתָּֽנוּ", "V'kiyamtanu"],
    ["קִיַּמְתָּנוּ", "Kiyamtanu"],
    // A genuinely vowel-less yod still completes the long hiriq and makes
    // the following sh'va vocal according to the existing rule.
    ["בִּינְךָ", "Bin'kha"]
  ]);
  const consonantalYod = internals.parseClusters("קִיַּמְתָּנוּ");
  internals.classifyVowels(consonantalYod, rules);
  internals.classifyShevas(consonantalYod, rules);
  assert.equal(consonantalYod[1].base, "י");
  assert.equal(consonantalYod[1].vowelName, "patach");
  assert.equal(consonantalYod[2].sheva, "silent");
});

test("audio lexicon uses corrected classifications and retains the tzere choice", () => {
  for (const tzere of ["e", "ei"]) {
    const audioEngine = new Transliterator(speech.speechRuleset(
      window.HebrewRulesets.speechEnglish, tzere
    ));
    for (const [input, expected] of [
      ["שֶׁאָמְרוּ", "ʃe.ʔa.me.ˈʁu"],
      ["לְבַבְכֶם", "le.vav.ˈxem"],
      ["וְהַמְרַחֵם", tzere === "ei" ? "ve.ha.me.ʁa.ˈxejm" : "ve.ha.me.ʁa.ˈxem"],
      ["וְקִיַּמְתָּֽנוּ", "ve.ki.jam.ˈta.nu"],
      ["וַיֶּחֱשׂף", "va.je.xe.ˈsof"]
    ]) {
      const entries = speech.lexiconEntries(input, audioEngine);
      assert.equal(entries.length, 1);
      assert.equal(entries[0].phoneme, expected, `${input}, tzere=${tzere}`);
    }
  }
});
