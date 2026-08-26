(function () {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeLookup(table) {
    for (const [key, value] of Object.entries(table)) {
      table[key.normalize("NFD")] = value;
    }
    return table;
  }

  function replaceKh(value) {
    return value.replace(/Kh/g, "Ch").replace(/kh/g, "ch");
  }

  function replaceModernMarks(value, separator, mappiqHeh) {
    return value.replace(/·/g, separator).replace(/ḣ/g, mappiqHeh);
  }

  function mapValues(table, mapper) {
    return Object.fromEntries(
      Object.entries(table).map(([key, value]) => [key, mapper(value)])
    );
  }

  const niqqudless = {
    "יי": "Adonai",
    "יהוה": "Adonai",
    "ה׳": "Adonai",
    "ה'": "Adonai",
    "ה’": "Adonai",
    "שיהוה": "she·Adonai",
    "ליהוה": "Ladonai",
    "ביהוה": "Badonai",
    "כיהוה": "Kadonai",
    "טוב": "tov",
    "עושה": "oseh",
    "בו": "bo",
    "או": "o",
    "אדני": "Adonai",
    "אלהינו": "Eloheinu",
    "אלהי": "Elohei",
    "גדל": "godel",
    "הכל": "hakol",
    "יעקב": "yaakov"
  };

  const exactWords = {
    "יְיָ": "Adonai",
    "אֲדֹנָי": "Adonai",
    "אֲדנָי": "Adonai",
    "אֱלֹהִים": "Elohim",
    "אֱלהִים": "Elohim",
    "אֱלֹהֵי": "Elohei",
    "אֱלהֵי": "Elohei",
    "אֱלֹהָי": "Elohai",
    "אֱלהָי": "Elohai",
    "אֱלֹהַי": "Elohai",
    "אֱלהַי": "Elohai",
    "אֱלֹהֵינוּ": "Eloheinu",
    "אֱלהֵינוּ": "Eloheinu",
    "לֵאלהֵינוּ": "leloheinu",
    "וֵאלהֵי": "ve·elohei",
    "אֱלֹהֶיךָ": "Elohekha",
    "אֱלהֶיךָ": "Elohekha",
    "אֱלֹהֵיכֶם": "Eloheikhem",
    "אֱלהֵיכֶם": "Eloheikhem",
    "אֱלֹהֵיכֶן": "Eloheikhen",
    "אֱלהֵיכֶן": "Eloheikhen",
    "אֱלֹהֶיהָ": "Eloheha",
    "אֱלהֶיהָ": "Eloheha",
    "אֱלֹהֵיהֶם": "Eloheihem",
    "אֱלהֵיהֶם": "Eloheihem",
    "אֱלֹהֵיהֶן": "Eloheihen",
    "אֱלהֵיהֶן": "Eloheihen",
    "אֵל": "El",
    "אֱלוֹהַּ": "Eloah",
    "אֱלוֹהַי": "Elohai",
    "אֱלֹהָיו": "Elohav",
    "אֲדֹנֵינוּ": "Adoneinu",
    "שֶׁיְהֹוָה": "she·Adonai",
    "יִשָּׂשכָר": "Yissakhar",
    "לָיְלָה": "lailah",
    "לַיהֹוָה": "Ladonai",
    "לַיהוָֹה": "Ladonai",
    "לַייָ": "Ladonai",
    "בַּיהֹוָה": "Badonai",
    "כַּיהֹוָה": "Kadonai",
    "כֵּאלֹהֵינוּ": "Keloheinu",
    "כַּאדונֵינוּ": "Kadoneinu",
    "הִוא": "hi",
    "הֽוּא": "hu",
    "הַהִוא": "hahi",
    "הָיְתָה": "hayetah",
    "שְׁתַּיִם": "shtayim",
    "שְׁתֵּי": "shtei",
    "יִשרָאֵל": "yisrael",
    "בְּיִשרָאֵל": "beyisrael",
    "גדֶל": "godel",
    "גּדֶל": "godel",
    "שפָתַי": "sefatay",
    "אֲבותֵינוּ": "avoteinu",
    "אָבות": "avot",
    "יַעֲקב": "yaakov",
    "הַכּל": "hakol",
    "בְּעָלְמָא": "be·alma",
    "וּלְעָלְמֵי": "ul·almei",
    "עָלְמַיָּא": "almaya",
    "עָלְ֒מַיָּא": "alemaya",
    "עָרְבָה": "arvah",
    "וְעָרְבָה": "ve·arvah",
    "דְכָל": "dekhol",
    "וַיְהִי": "vayehi",
    "מִשְׁנֶה": "mishneh",
    "מִשְׂגָּב": "misgav",
    "מִקְדָּשׁ": "mikdash",
    "מִצְוֹתָי": "mitzvotay",
    "כּל": "kol",
    "כל": "khol",
    "לא": "lo",
    "לו": "lo",
    "וְלא": "velo",
    "ולו": "velo",
    "וכל": "vekhol",
    "וכּל": "vekol",
    "כָּל": "kol",
    "כָּל": "kol",
    "כָל": "kol",
    "ככָּל": "khkol",
    "ככָל": "khkol",
    "לכָּל": "lkol",
    "לכָל": "lkol",
    "הכָּל": "hkol",
    "הכָל": "hkol",
    "מִכָּל": "mikol",
    "מִכָל": "mikol",
    "בכָּל": "vkol",
    "בכָל": "vkol",
    "בְּכָּל": "bekhol",
    "בְּכָל": "bekhol",
    "וּבְכָּל": "uv·khol",
    "וּבְכָל": "uv·khol",
    "וּבְכׇּל": "uv·khol",
    "וּבְכׇל": "uv·khol",
    "שכָּל": "shkol",
    "שכָל": "shkol",
    "וְכָּל": "vekhol",
    "וְכָל": "vekhol",
    "לָךְ": "lakh"
  };

  const silentInitialMemSheva = {
    "מִזְבֵּחַ": true,
    "מִזְבְּחוֹת": true,
    "מִנְחָה": true,
    "מִנְחוֹת": true,
    "מִצְרַיִם": true,
    "מִקְנֶה": true,
    "מִקְנִים": true,
    "מִשְׁנֶה": true,
    "מִשְׁנָה": true,
    "מִשְׁנִים": true,
    "מִשְׁנָיוֹת": true,
    "מִשְׁתֶּה": true,
    "מִשְׁתִּים": true,
    "מִשְׁגֶּה": true,
    "מִשְׁגִּים": true,
    "מִשְׂגָּב": true,
    "מִשְׂגַּבִּים": true,
    "מִצְוָה": true,
    "מִצְוֹת": true
  };
  Object.assign(silentInitialMemSheva, window.HebrewMorphhbSilentInitialMemSheva || {});

  const phraseCapitalization = {
    "אַתָּה": "Atah",
    "אַתָּה": "Atah"
  };

  const stressOverrides = {
    "אֱלֹהֵינוּ": { vowelFromEnd: 2 },
    "אֱלהֵינוּ": { vowelFromEnd: 2 },
    "אֱלֹהֶיךָ": { vowelFromEnd: 2 },
    "אֱלהֶיךָ": { vowelFromEnd: 2 }
  };

  const stressRuleWords = {
    "וַיְהִי": true
  };

  normalizeLookup(exactWords);
  normalizeLookup(silentInitialMemSheva);
  normalizeLookup(phraseCapitalization);
  normalizeLookup(stressOverrides);
  normalizeLookup(stressRuleWords);

  window.HebrewRulesets = window.HebrewRulesets || {};
  const modernSefardi = {
    id: "modernSefardi",
    name: "Modern Sephardi",
    consonants: {
      "א": "",
      "ב": { dagesh: "b", plain: "v" },
      "ג": "g",
      "ד": "d",
      "ה": "h",
      "ו": "v",
      "ז": "z",
      "ח": "ḥ",
      "ט": "t",
      "י": "y",
      "כ": { dagesh: "k", plain: "kh" },
      "ך": { dagesh: "k", plain: "kh" },
      "ל": "l",
      "מ": "m",
      "ם": "m",
      "נ": "n",
      "ן": "n",
      "ס": "s",
      "ע": "",
      "פ": { dagesh: "p", plain: "f" },
      "ף": { dagesh: "p", plain: "f" },
      "צ": "tz",
      "ץ": "tz",
      "ק": "k",
      "ר": "r",
      "ש": { shin: "sh", sin: "s", plain: "sh" },
      "ת": "t"
    },
    vowels: {
      patach: "a",
      kamatzGadol: "a",
      kamatzKatan: "o",
      segol: "e",
      tzere: "e",
      hiriq: "i",
      holam: "o",
      kubutz: "u",
      chatafPatach: "a",
      chatafSegol: "e",
      chatafKamatz: "o",
      shuruk: "u",
      vocalSheva: "e"
    },
    output: {
      vowelSeparator: "·",
      consonantSeparator: "·",
      mappiqHeh: "ḣ",
      conjunctiveShuruk: "u",
      dashedInitialPrefixes: []
    },
    exceptions: {
      exactWords,
      niqqudless,
      silentInitialMemSheva,
      phraseCapitalization,
      stressOverrides,
      stressRuleWords
    }
  };

  const levShalem = clone(modernSefardi);
  levShalem.id = "levShalem";
  levShalem.name = "Lev Shalem";
  levShalem.vowels.vocalSheva = "'";
  levShalem.output.vowelSeparator = "·";
  levShalem.output.consonantSeparator = "'";
  levShalem.output.mappiqHeh = "h";
  levShalem.output.conjunctiveShuruk = "u-";
  levShalem.output.dashedInitialPrefixes = ["she", "ba", "la", "mi", "ha"];
  levShalem.exceptions.exactWords = normalizeLookup(mapValues(exactWords, (value) => replaceModernMarks(value, "·", "h")));
  levShalem.exceptions.niqqudless = normalizeLookup(mapValues(niqqudless, (value) => replaceModernMarks(value, "·", "h")));
  levShalem.exceptions.phraseCapitalization = normalizeLookup(mapValues(phraseCapitalization, (value) => replaceModernMarks(value, "·", "h")));
  levShalem.exceptions.exactWords["שֶׁיְהֹוָה".normalize("NFD")] = "she-Adonai";
  levShalem.exceptions.exactWords["בְּעָלְמָא".normalize("NFD")] = "b'alma";
  levShalem.exceptions.exactWords["דְכָל".normalize("NFD")] = "d'khol";
  levShalem.exceptions.exactWords["וַיְהִי".normalize("NFD")] = "vay'hi";
  levShalem.exceptions.exactWords["הָיְתָה".normalize("NFD")] = "hay'tah";
  levShalem.exceptions.exactWords["וּלְעָלְמֵי".normalize("NFD")] = "u-l·almei";
  levShalem.exceptions.exactWords["וּבְכָּל".normalize("NFD")] = "u-v'khol";
  levShalem.exceptions.exactWords["וּבְכָל".normalize("NFD")] = "u-v'khol";
  levShalem.exceptions.exactWords["וּבְכׇּל".normalize("NFD")] = "u-v'khol";
  levShalem.exceptions.exactWords["וּבְכׇל".normalize("NFD")] = "u-v'khol";
  levShalem.exceptions.exactWords["וְלא".normalize("NFD")] = "v'lo";
  levShalem.exceptions.niqqudless["שיהוה"] = "she-Adonai";

  const mishkanTefilah = clone(modernSefardi);
  mishkanTefilah.id = "mishkanTefilah";
  mishkanTefilah.name = "Mishkan Tefilah";
  mishkanTefilah.consonants["כ"].plain = "ch";
  mishkanTefilah.consonants["ך"].plain = "ch";
  mishkanTefilah.consonants["ח"] = "ch";
  mishkanTefilah.vowels.tzere = "ei";
  mishkanTefilah.vowels.vocalSheva = "'";
  mishkanTefilah.output.vowelSeparator = "-";
  mishkanTefilah.output.consonantSeparator = "-";
  mishkanTefilah.exceptions.exactWords = normalizeLookup(mapValues(exactWords, (value) => replaceKh(replaceModernMarks(value, "-", "ḣ"))));
  mishkanTefilah.exceptions.niqqudless = normalizeLookup(mapValues(niqqudless, (value) => replaceKh(replaceModernMarks(value, "-", "ḣ"))));
  mishkanTefilah.exceptions.phraseCapitalization = normalizeLookup(mapValues(phraseCapitalization, (value) => replaceKh(replaceModernMarks(value, "-", "ḣ"))));
  mishkanTefilah.exceptions.exactWords["בְּעָלְמָא".normalize("NFD")] = "b'alma";
  mishkanTefilah.exceptions.exactWords["דְכָל".normalize("NFD")] = "d'chol";
  mishkanTefilah.exceptions.exactWords["אֱלֹהֵיכֶם".normalize("NFD")] = "Eloheichem";
  mishkanTefilah.exceptions.exactWords["אֱלֹהֵיכֶן".normalize("NFD")] = "Eloheichen";
  mishkanTefilah.exceptions.exactWords["הָאֵל".normalize("NFD")] = "ha-el";
  mishkanTefilah.exceptions.exactWords["וַיְהִי".normalize("NFD")] = "vay'hi";
  mishkanTefilah.exceptions.exactWords["הָיְתָה".normalize("NFD")] = "hay'tah";
  mishkanTefilah.exceptions.exactWords["וְלא".normalize("NFD")] = "v'lo";

  window.HebrewRulesets.modernSefardi = modernSefardi;
  window.HebrewRulesets.levShalem = levShalem;
  window.HebrewRulesets.mishkanTefilah = mishkanTefilah;
  window.HebrewRulesets.all = [
    modernSefardi,
    levShalem,
    mishkanTefilah
  ];
})();
