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
    "ויהוה": "Vadonai",
    "ה׳": "Adonai",
    "ה'": "Adonai",
    "ה’": "Adonai",
    "שיהוה": "she·Adonai",
    "ליהוה": "Ladonai",
    "ביהוה": "Badonai",
    "כיהוה": "Kadonai",
    "מיהוה": "me·Adonai",
    "ומיהוה": "ume·Adonai",
    "וביהוה": "uvadonai",
    "וכיהוה": "ukhadonai",
    "וליהוה": "veladonai",
    "היהוה": "ha·Adonai",
    "טוב": "tov",
    "עושה": "oseh",
    "בו": "bo",
    "או": "o",
    "אור": "or",
    "הוד": "hod",
    "סוף": "sof",
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
    "וְכָל": "vekhol",
    "כְּכָל": "kekhol",
    "מִן": "min",
    "לָךְ": "lakh"
  };

  const silentInitialPrefixSheva = {
    "לַחְמָם": true,
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
    "מִצְוֹת": true,
    // Lexical/hifil forms in Lev Shalem: the initial he is not the article.
    "הַזְכָּרַת": true,
    "הַגְבָּהַת": true,
    "הַכְנָסַת": true,
    "הַשְׁכִּיבֵנוּ": true,
    "הַשְׁתָּא": true,
    "הַנְחִילֵנוּ": true,
    "הַסְתִּירֵם": true,
    // Reviewed Lev Shalem lexical/assimilated forms. Preserve the general
    // hiriq-prefix rule for true prefixes such as מִלְמָעְלָה.
    "מִתְנַשְּׂאִים": true,
    "מִשְׁאֲלוֹת": true,
    "מִשְׁאֲלוֹתֵינוּ": true,
    "מִשְׁאֲלִין": true,
    "מִשְׁפְּחוֹתֵיהֶם": true,
    "מִשְׁפַּחְתָּהּ": true,
    "מִשְׁפַּתְתָּהּ": true,
    "מִשְׁפַּתְתּוֹ": true,
    "מִשְׂגַּבֵּנוּ": true,
    "מִתְפַּלְלִים": true,
    "מִשְׁכְּבוֹתֵיהֶם": true,
    "מִתְעַנִּין": true,
    "מִתְיַחֲדִין": true,
    "מִתְעַבְּרִין": true,
    "מִתְעַטְּרִין": true,
    "מִתְעַטֵּף": true,
    "מִקְצֵה": true,
    "בִמְנוּחָתֵנוּ": true,
    "בִשְׁמַיָּא": true,
    "בִרְצוֹנְךָ": true,
    "בִגְדֵיהֶם": true,
    "בִשְׁמֶךָ": true,
    "בִנְדִיבִים": true,
    "בִגְבוּרַת": true,
    "בִגְבוּרֹתָיו": true,
    "בִמְצוֹלֹת": true,
    "בִלְתּוֹ": true,
    "בִטְנְךָ": true,
    "בִפְתִילַת": true,
    "בִרְכָתֶךָ": true,
    "בִשְׁמוֹ": true,
    "בִשְׁמִי": true
  };
  Object.assign(silentInitialPrefixSheva, window.HebrewMorphhbSilentInitialMemSheva || {});
  Object.assign(silentInitialPrefixSheva, window.HebrewWikidataSilentInitialMemSheva || {});
  Object.assign(silentInitialPrefixSheva, window.HebrewOtherPrefixSilentInitialSheva || {});
  const lexicalInitialShe = normalizeLookup(window.HebrewLexicalInitialShe || {});
  const forcedKamatzGadol = normalizeLookup(window.HebrewMamForcedKamatzGadol || {});
  const levShalemForcedKamatzGadol = normalizeLookup(
    window.HebrewLevShalemForcedKamatzGadol || {}
  );
  const forcedKamatzKatan = normalizeLookup(
    window.HebrewLevShalemForcedKamatzKatan || {}
  );
  // Infinitive with possessive suffix, e.g. 1 Kings 14:21.
  for (const prefix of ["בְּ", "בְ", "לְ"]) {
    forcedKamatzKatan[(prefix + "מָלְכוֹ").normalize("NFD")] = [1];
  }
  // Siddur Aramaic not present in the Tanakh-derived MAM table.
  forcedKamatzGadol["עָלְמִין".normalize("NFD")] = [0];
  // Siddurim can omit the conjunction from the MAM-attested
  // וְיִכָּלְמוּ while retaining the same pointed stem.
  forcedKamatzGadol["יִכָּלְמוּ".normalize("NFD")] = [1];

  // Some Sefaria Tanakh forms omit the meteg that would explicitly mark a
  // kamatz as gadol before a vocal sh'va. Keep this list narrow so genuine
  // kamatz-katan forms such as חָכְמָה continue to follow the general rule.
  const missingMetegKamatzSheva = {
    // Reviewed אמרו family: vocal sh'va is a separate decision from the
    // MAM gadol-only table. Do not inherit this map through arbitrary prefixes.
    "אָמְרוּ": true,
    "שֶׁאָמְרוּ": true,
    "וְשֶׁאָמְרוּ": true,
    "שָׁרְצוּ": true,
    "נָפְלוּ": true,
    "גָּבְרוּ": true,
    "יָצְאוּ": true,
    "יָזְמוּ": true,
    "וְאָמְרוּ": true,
    "יִמָּצְאוּן": true,
    "גָּזְלוּ": true,
    "וַיִּשָּׁבְעוּ": true,
    "מָלְאוּ": true,
    "נָסְעוּ": true,
    "מָכְרוּ": true,
    "לָקְחוּ": true,
    "יִקָּרְאוּ": true,
    "הִקָּבְצוּ": true,
    "קָבְרוּ": true,
    // Whole-Tanakh MAM/WLC cross-edition audit: MAM omits the meteg at
    // one or more occurrences while the matching WLC occurrence supplies it.
    "וָמָתְנוּ": true,
    "פָּשְׁטוּ": true,
    "יָרְאָה": true,
    "נָבְלָה": true,
    "שָׁכְנָה": true,
    "בָּרְחוּ": true,
    "הַדָּבְרַת": true,
    "הָרְמָחִים": true,
    "וּבָרְמָחִים": true,
    "וְהָרְעָלוֹת": true,
    "וַיִּנָּגְעוּ": true,
    "וְנִוָּכְחָה": true,
    "חָנְטָה": true,
    "כָּפְנָה": true,
    "לָרְוָיָה": true,
    "סָגְרוּ": true,
    "עָתְקָה": true,
    "פָּתְחוּ": true,
    "שָׁבְרָה": true,
    "שָׁכְרוּ": true,
    "תֵּחָלְצוּ": true,
    // Supplied Lev Shalem volumes print these as qamatz gadol followed by
    // sh'va na even where the source text lacks a meteg.
    "דְּעָסְקִין": true,
    "דְעָלְמָא": true,
    "וְיִכָּנְסוּ": true,
    "וּפָתְחוּ": true,
    "וְשֶׁנִּתְפָּרְשׁוּ": true,
    "וְתִתְפָּרְקוּן": true,
    "יָקְרוּ": true,
    "צָדְקוּ": true,
    "קָפְאוּ": true,
    "שֶׁיִּכָּנְסוּ": true,
    "שֶׁיִּמָּלְאוּ": true,
    "שֶׁמָּסְרוּ": true,
    "תִכָּלְמִי": true,
    "יֵחָלְצוּן": true,
    "מָלְאָה": true,
    "נָשְׂאוּ": true,
    "גָּדְלוּ": true,
    "הָרְשָׁעִים": true,
    "הִשָּׁמְרוּ": true,
    "עָמְקוּ": true,
    "כָשְׁלוּ": true,
    "לָרְעֵבִים": true,
    "שָׁמְרוּ": true,
    "וְשָׁמְרוּ": true,
    "הָרְחוֹקִים": true,
    "בָּרְחוֹב": true,
    "וְהִנָּשְׂאוּ": true,
    "וַיְגָרְשֵׁהוּ": true,
    "חָפְרוּ": true,
    "יָדְעוּ": true,
    "לָבְשׁוּ": true,
    "שֶׁבָּטְחוּ": true,
    "שָׁמְעָה": true,
    "שָׁמְעוּ": true
  };

  const silentShevaByWord = {
    // Narrow morphological/lexical exceptions. A broad suffix rule changes
    // many valid sh'va-na forms after long vowels.
    "אוּקִימְנָא": [4],
    "אֹהַבְךָ": [2],
    "חִיָּתְנִי": [2],
    "תַּחְגֹּרְנָה": [3],
    "נַחֲלַתְכֶם": [3],
    "יִשָּׂאוּנְךָ": [4],
    "לַחְפֹּר": [1],
    "בַּרְתּוֹתָא": [1],
    // Lev Shalem explicitly prints qamatz qatan plus silent sh'va here.
    "וּפָקְדֵנוּ": [2]
  };

  const phraseCapitalization = {
    "אַתָּה": "Atah",
    "אַתָּה": "Atah"
  };

  const lexicalInitialHey = {
    // Daniel 5:7,16,29: Aramaic noun, not Hebrew article + mem.
    // Preserve existing pronunciation pending a separate Aramaic review.
    "הַמְנִיכָא": true,
    // These pointed spellings can also be verbs (Genesis 43:3, Psalm 35:23).
    // Keep the neutral vowel separator when the spelling alone is ambiguous.
    "הָעֵד": true,
    "הָעִירָה": true
  };

  const stressOverrides = {
    "לָיְלָה": { vowelFromEnd: 2, unaccentedOnly: true },
    "שְׁתַּיִם": { vowelFromEnd: 2, unaccentedOnly: true },
    "אֱלֹהֵינוּ": { vowelFromEnd: 2 },
    "אֱלהֵינוּ": { vowelFromEnd: 2 },
    "אֱלֹהֶיךָ": { vowelFromEnd: 2 },
    "אֱלהֶיךָ": { vowelFromEnd: 2 }
  };

  const stressRuleWords = {
    "וַיְהִי": true
  };

  // Fallback for unaccented siddur text and lone dehi. The listed dehi spellings
  // also occur with a locating accent in at least three separate MAM verses,
  // unanimously penultimate. Includes the common segolate חֶסֶד and its controls.
  const penultimateStress = Object.fromEntries(`
אֱלֹהֵינוּ אֱלֹהֶיךָ אֲבֹתֶיךָ אֲנַחְנוּ אִוֶּלֶת אֵבוֹשָׁה אֵלֶּה אֵלֶיךָ אֵפֶר
אֶבֶן אֶרֶץ אַחֲרֶיהָ אַיִן אַפַּיִם אָהַבְתִּי אָוֶן אָמַרְתִּי אָנִי
אֹזֶן אֹכֶל אֹמֶר אׇזְנַיִם אוֹיְבֶיךָ בְּלִיַּעַל בְּמִצְרַיִם בְּצֶדֶק בַּבֹּקֶר
בַּסֵּתֶר בַּקַּיִץ בַּשָּׁמַיִם בָּאָרֶץ בָּנֶיךָ בָּעֶרֶב בָנֶיהָ בֹּאוּ בֹּקֶר
גֶּבֶר גֶּפֶן דִּבַּרְתִּי דֶּשֶׁא הֲבִינֵנִי הֲיָדַעְתָּ הִגַּדְתִּי הִשָּׁמֶר הֵמָּה
הֵנָּה הַגֶּבֶר הַדֶּלֶת הַדֶּרֶךְ הַוּוֹת הַיַּיִן הַכֶּסֶף הַלְלוּהוּ הַמֶּלֶךְ
הַצִּילֵנִי הַשֶּׁמֶשׁ הַשָּׁמַיִם הָאֵלֶּה הָאָרֶץ הָיִיתִי הָיִיתָ הוֹשִׁיעֵנִי וְאֵלֶּה
וְאֶפְרַיִם וְהֵמָּה וְהָיִיתָ וְחֶרֶב וְלַיְלָה וְצַלְמָוֶת וַיַּגִּידוּ וַיַּעַן וַתֹּאמֶר
וָאֶבֶן וָאַיִן וָחֶסֶד וָשֶׁמֶן וּבְדַעַת וּמַיִם זֶרַע חֶסֶד חֶרֶב
חַיִל חַתּוּ חָטָאתִי חָסִיתִי חֹשֶׁךְ טֶרֶף יְרוּשָׁלִַם יִתְּנֵנִי יֵבֹשׁוּ
יַחַד יָבֹאוּ יָדֵינוּ יָדֶיהָ יָדַעְתִּי יָדַעְתָּ יָלִינוּ יָמֵינוּ יָשׁוּבוּ
יוֹעִילוּ כַּמַּיִם לְאֵבֶל לְאָבִיךָ לְמַעַן לְפָנֶיךָ לְרֵעֵהוּ לֶחֶם לַיְלָה
לַיִשׁ לַכֶּסֶף לַנַּעַר לָאָרֶץ לָבֶטַח לָמָּה לָנֶצַח לָנוּ לָקַחַת
מִלְּפָנֶיךָ מִמֶּנִּי מִנֶּגֶד מִנַּחַל מִצְוֺתֶיךָ מִצְרַיִם מִשְׁפָּטֶיךָ מִשָּׁמַיִם מִתַּחַת
מֵחֶרֶב מֵרֶחֶם מֶלֶךְ מַיִם מָצָאתִי נֶפֶשׁ נַפְשֵׁנוּ סְבָבוּנִי סֶלַע
עֲבָדֶיךָ עֲנֵנִי עֵדֹתֶיךָ עֵזֶר עֵינֶיךָ עֵינַיִם עֶבֶד עַיִן עָלֵינוּ
עָלֶיהָ עָלֶיךָ עָשִׂיתִי עָשִׂיתָ עוּרָה פִּיהָ פִּיךָ פִקּוּדֶיךָ פֶּרֶץ
פֶּשַׁע פֶרֶץ פֶשַׁע פָּנֶיךָ פָּעַלְתָּ פָנֶיךָ צִוִּיתָ צֶדֶק צַלְמָוֶת
קְרָאתִיךָ קִוִּיתִי קִנֵּאתִי קָרָאתִי קֹדֶשׁ קֹרַח רֶמֶשׂ רֶשֶׁת רַגְלֶיהָ
רָאִיתִי רָאִיתָ שְׂפָתַיִם שִׁבְעָתַיִם שֶׁבֶר שֶׁקֶר שַׂמְתָּ שָׁמַיִם שָׁמַעְנוּ
שָׁמַעְתִּי שָׁמַעְתָּ שָׁמַרְתִּי שָׁמָּה שָׂנֵאתִי שֹׁמַעַת שׇׁמְרֵנִי תַּחַת תָּשֻׁבוּ
  `.normalize("NFD").trim().split(/\s+/u).map(word => [word, true]));

  // Prayer spellings with consistent stress in the MAM accent audit. Use only
  // in unaccented words. Preserve the explicit reading in cantillated text.
  const prayerPenultimateStress = Object.fromEntries(`
אֱלִיעֶזֶר אֱלֹהַיִךְ אֱלֹהָיִךְ אֲבוֹתֵינוּ אֲמָתֶךָ אֲנָחְנוּ אִמְרָתֶךָ אִמֶּךָ אִתָּנוּ אֵינֶנּוּ
אֵלִיָּהוּ אֵלֵינוּ אֵלֶיהָ אֵצֶל אֵשֶׁת אֶלֶף אֶפְרַיִם אֶפְרָיִם אֶפֶס אֶרֶךְ
אַחֵינוּ אַחֶרֶת אַיִל אַפֶּךָ אָבִיךָ אָבִינוּ אָבֶן אָהַבְתָּ אָהָבְתִּי אָחִיךָ
אָיִן אָמַרְתָּ אָרֶץ אָשִׁירָה אָשִׂיחָה אָתָּה אֹהֶל אֹיְבֶיךָ אֹרֶךְ אֹרַח
אׇזְנֶךָ בְּאֶרֶץ בְּבֵיתֶךָ בְּדֶרֶךְ בְּטֶרֶם בְּיָדֶךָ בְּמִצְרָיִם בְּמַיִם בְּסֵפֶר בְּסֵתֶר
בְּעֵינֶיךָ בְּעֵמֶק בְּפִיךָ בְּפַעַם בְּקִרְבֵּנוּ בְּשֶׁמֶן בְעֵינֶיךָ בִּישׁוּעָתֶךָ בִּלְבָבֶךָ בֵּינֵינוּ
בֵּיתֶךָ בֵיתֶךָ בַּבַּיִת בַּחֹשֶׁךְ בַּיִת בַּלָּיְלָה בַּמַּיִם בַּמָּיִם בַּעַל בַּפַּעַם
בַּקֹּדֶשׁ בַדֶּרֶךְ בַחֶרֶב בַמַּיִם בַסֵּתֶר בַשֶּׁמֶן בַשָּׁמֶן בָּאתִי בָּחַרְתָּ בָּנֵינוּ
בָּנֶיהָ בָּנַיִךְ בָאָרֶץ בָנֶיךָ דְּבָרֶיךָ דְּרָכֶיךָ דִּבַּרְתָּ דֶּבֶר דֶּרֶךְ דַּעַת
דַּרְכֶּךָ דָּעַת דָעַת דָרֶךְ הֲשִׁיבֵנוּ הִכֵּיתִי הִנֵּנִי הֵיטִיבוּ הֵפֵרוּ הֶבֶל
הַאֲזִינָה הַאֲזִינוּ הַבַּיְתָה הַבַּיִת הַגִּידָה הַגֶּשֶׁם הַגָּשֶׁם הַחֹדֶשׁ הַיֶּלֶד הַיַּעַר
הַיָּלֶד הַיָּעַר הַלַּיְלָה הַמִּדְבָּרָה הַמִּזְבֵּחָה הַמַּיִם הַמָּיִם הַנֶּפֶשׁ הַנַּעַר הַנָּעַר
הַפֶּסַח הַפַּעַם הַקְשִׁיבָה הַקֹּדֶשׁ הַשְׁמִיעוּ הַשַּׁחַר הַשַּׁעַר הַשָּׁמֶשׁ הַשָּׁמַיְמָה הַשָּׁמָיִם
הָאֶבֶן הָאַיִל הָבֶל הָלַכְתִּי הָרִימוּ הָרִיעוּ הָרָמָתָה הוֹדִיעוּ הוֹצִיאוּ הוֹצֵאתִי
וְאֵינֶנּוּ וְאַיִל וְאָשׁוּבָה וְאֹרֶךְ וְהַמַּיִם וְהַנַּעַר וְהָאָרֶץ וְחֶסֶד וְחׇנֵּנִי וְיִצְהָרֶךָ
וְיִשְׂמָחוּ וְיָרֵאתָ וְיָשֻׁבוּ וְלָלֶכֶת וְלָמָּה וְנֶפֶשׁ וְנָשׁוּבָה וְעֵינֶיךָ וְעָשִׂיתָ וְקָרָאתָ
וְשָׂבָעְתָּ וְשׁוּבוּ וְתַחַת וַאֲדַבֵּרָה וַאֲנַחְנוּ וַיְבָרֶךְ וַיִּבֶן וַיִּחַר וַיִּנָּחֶם וַיִּשְׁתַּחוּ
וַיֵּדַע וַיֵּרֶד וַיֵּרַע וַיֵּשֶׁב וַיַּעֲלֵהוּ וַיַּעֲנֵנִי וַיַּעַל וַיַּעַשׂ וַיַּשְׁכִּמוּ וַיָּבִאוּ
וַיָּגׇר וַיָּחֶל וַיָּמֻתוּ וַיָּקֻמוּ וַיָּקׇם וַיָּרֶם וַיָּשֶׁת וַיָּשֶׂם וַיָּשֻׁבוּ וַיָּשׇׁב
וַיּוֹשַׁע וַתֵּלֶד וַתֵּרֶא וַתֵּשֶׁב וַתַּהַר וַתַּעַל וַתַּעַן וַתַּעַשׂ וַתָּקׇם וָאֵפֶר
וָאָרֶץ וָהָלְאָה וָלָיְלָה וּבְנוֹתֶיהָ וּבַמַּיִם וּבַעַל וּבָאָרֶץ וּבָאוּ וּכְרָמֵינוּ וּלְמַעַן
וּלְתִפְאָרֶת וּמֶלֶךְ וּשְׁנַיִם זֶבַח זַרְעֶךָ חֲמֵשֶׁת חֵלֶב חֵלֶק חֵפֶץ חֵקֶר
חֶבֶל חַיֶּיךָ חַסְדֶּךָ חָטָאנוּ חָיִל חָסֶד חָפַצְתִּי חָפָצְתִּי חָרֶב חֹדֶשׁ
חֻקֶּיךָ חוּצָה טֶרֶם יְדַבֵּרוּ יְהַלֵּכוּ יְמִינֶךָ יְרַנֵּנוּ יִחָלְתִּי יִכָּרֵתוּ יִכָּשֵׁלוּ
יִרְמְיָהוּ יִשְׁמָעוּ יִשְׁעֵנוּ יִשְׁעֶךָ יִשְׂבָּעוּ יִתַּמּוּ יֶאְשָׁמוּ יֶתֶר יַבִּיטוּ יַגִּידוּ
יַיִן יַעַן יַעַר יָגִילוּ יָגוּרוּ יָדֶיךָ יָדֶךָ יָדַיִם יָדָיִם יָחַד
יָמֶיךָ יוֹדוּךָ כְּבוֹדֶךָ כְּנַעַן כְּנָעַן כְּנָפֶיךָ כִּדְבָרֶךָ כֶּבֶשׂ כֶּסֶף כַּעַס
כָּכָה כָּמוֹךָ כָמוֹךָ כֻּלָּנוּ לְבַדֶּךָ לְבָבֶךָ לְבָנֶיךָ לְמֶלֶךְ לְמַעְלָה לְנֶגֶד
לְעַבְדֶּךָ לִבֵּנוּ לִבֶּךָ לִקְרָאתֵנוּ לִשְׁמֶךָ לֵאלֹהֵינוּ לֶקַח לַבַּיִת לַחֶרֶב לַכֶּבֶשׂ
לַמְּדֵנִי לַמֶּלֶךְ לַמַּיִם לַשָּׁקֶר לָּנוּ לָאַיִל לָדַעַת לָלֶכֶת לָמוֹ לָשָׁבֶת
מְאוּמָה מְדַבֶּרֶת מְלֶאכֶת מְשִׁיחֶךָ מִבֶּטֶן מִלְמַעְלָה מִמִּצְרַיִם מִמִּצְרָיִם מִמֶּךָּ מִמֶּנּוּ
מִמַּיִם מִמַּעַל מִמָּוֶת מִפַּחַד מִפָּנֶיךָ מִצְרָיִם מִקֶּדֶם מִקֶּרֶב מִתָּחַת מֵאֶרֶץ
מֵאַיִן מֵהֵנָּה מֵעֶרֶב מֵעַמֶּיהָ מֵעָלֵינוּ מֶלַח מֶנִּי מַעֲשֵׂהוּ מַעֲשֶׂיךָ מָוֶת
מָיִם נִחַמְתִּי נִשְׁבַּעְתִּי נִשְׁבַּעְתָּ נֶגֶד נֶדֶר נֶצַח נַחֲלָתֶךָ נַפְשֶׁךָ נָפֶשׁ
נָשָׂאתִי נָתַתִּי נָתַתָּ סֵפֶר סֶּלָה סֶלָה עֲזָבוּנִי עֲטֶרֶת עֲצֶרֶת עִמָּנוּ
עֵגֶל עֵדֶר עֵינֵינוּ עֵינַיִךְ עֵינָיִם עֵקֶב עֵשֶׂב עֶרֶב עַבְדֶּךָ עַמֶּךָ
עָוֶל עָלַיִךְ עָשָׂהוּ עֻזֶּךָ פִּקּוּדֶיךָ פֶּלֶג פֶּתַח פֶסֶל פַּעַם פָּשְׁעוּ
צִדְקֶךָ צֶמֶד צֶמֶר צֶמַח קֵדְמָה קֶדֶם קֶרֶן קֶשֶׁר קֶשֶׁת קָמוּ
קָנִיתָ קָרָאתָ קׇדְשֶׁךָ קוֹלֶךָ רֵעֵהוּ רֵעֶךָ רֶגֶל רֶגַע רֶשַׁע רַגְלֶךָ
רַחֲמֶיךָ רַעַשׁ רָאִינוּ שְׁמֶךָ שְׁנַיִם שְׂפָתֶיהָ שִׁוִּיתִי שִׁוַּעְתִּי שִׁירוּ שֵׁבֶט
שֵׁשֶׁת שֶׁבֶת שֶׁבַע שֶׁמֶשׁ שַׁעַר שָׁבַע שָׁמָיִם שָׁתִיתִי שָׂרֶיהָ תְּהִלָּתֶךָ
תְּכֵלֶת תִּהְיֶינָה תִּירָאוּ תִּפְאֶרֶת תַּחְתֶּיהָ תַּקְרִיבוּ תַּרְשִׁישָׁה תָמוּתוּ תּוֹלַעַת תּוֹרָתֶךָ
תוֹרָתֶךָ
  `.normalize("NFD").trim().split(/\s+/u).map(word => [word, true]));

  // Word-initial dagesh kal varies with the preceding word. Either spelling
  // keeps the same stress, while consonant rendering still uses the input.
  for (const word of Object.keys(prayerPenultimateStress)) {
    if (/^[בגדכפת]/u.test(word)) {
      const plain = word.replace(/^(.)(\p{M}*)/u, (_, letter, marks) => letter + marks.replace("ּ", ""));
      prayerPenultimateStress[plain] = true;
      prayerPenultimateStress[(plain[0] + "ּ" + plain.slice(1)).normalize("NFD")] = true;
    }
  }

  // Both attested Daniel forms (5:6 and 5:9) stress their consonantal vo.
  penultimateStress["זִיוֺהִי"] = true;
  penultimateStress["וְזִיוֺהִי"] = true;

  normalizeLookup(exactWords);
  normalizeLookup(silentInitialPrefixSheva);
  // After a consonant with sh'va, וֹ and וֺ both denote consonantal vo.
  // Accept either encoding in the reviewed lexical list (e.g. מִצְוֹתָיו).
  for (const table of [silentInitialPrefixSheva, penultimateStress]) {
    for (const key of Object.keys(table)) {
      if (key.includes("ֺ")) {
        const ordinaryHolam = key.replace(/(ְ[\u05bc\u05c1\u05c2]*ו)ֺ/gu, "$1ֹ");
        table[ordinaryHolam] = true;
      }
    }
  }
  normalizeLookup(missingMetegKamatzSheva);
  normalizeLookup(silentShevaByWord);
  normalizeLookup(lexicalInitialHey);
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
      silentInitialPrefixSheva,
      lexicalInitialShe,
      lexicalInitialHey,
      forcedKamatzGadol,
      levShalemForcedKamatzGadol,
      forcedKamatzKatan,
      missingMetegKamatzSheva,
      silentShevaByWord,
      phraseCapitalization,
      stressOverrides,
      prayerPenultimateStress,
      penultimateStress,
      stressRuleWords
    }
  };

  const levShalem = clone(modernSefardi);
  levShalem.id = "levShalem";
  levShalem.name = "Lev Shalem";
  levShalem.vowels.tzere = "ei";
  levShalem.vowels.vocalSheva = "'";
  levShalem.output.vowelSeparator = "·";
  levShalem.output.consonantSeparator = "'";
  levShalem.output.mappiqHeh = "h";
  levShalem.output.conjunctiveShuruk = "u-";
  levShalem.output.maqafSeparator = " ";
  levShalem.output.fusedMaqafWords = ["הללו־יה"];
  levShalem.output.tzereOnConsonantalYod = "e";
  levShalem.output.undageshedBetHiriqPrefix = true;
  levShalem.output.clarityConsonantPairs = ["t|h", "t|ḥ", "sh|t", "sh|kh", "kh|kh"];
  levShalem.output.dashedInitialPrefixes = [
    "ve", "va", "she", "ba", "be", "bi", "vi",
    "la", "le", "li", "mi", "mei", "ha", "he", "ka", "ki"
  ];
  levShalem.exceptions.exactWords = normalizeLookup(mapValues(exactWords, (value) => replaceModernMarks(value, "·", "h")));
  levShalem.exceptions.niqqudless = normalizeLookup(mapValues(niqqudless, (value) => replaceModernMarks(value, "·", "h")));
  levShalem.exceptions.phraseCapitalization = normalizeLookup(mapValues(phraseCapitalization, (value) => replaceModernMarks(value, "·", "h")));
  levShalem.exceptions.exactWords["שֶׁיְהֹוָה".normalize("NFD")] = "she-Adonai";
  levShalem.exceptions.niqqudless["מיהוה"] = "mei-Adonai";
  levShalem.exceptions.niqqudless["ומיהוה"] = "u-mei-Adonai";
  levShalem.exceptions.niqqudless["וביהוה"] = "u-vadonai";
  levShalem.exceptions.niqqudless["וכיהוה"] = "u-khadonai";
  levShalem.exceptions.niqqudless["וליהוה"] = "v'ladonai";
  levShalem.exceptions.niqqudless["היהוה"] = "ha-Adonai";
  levShalem.exceptions.exactWords["בְּעָלְמָא".normalize("NFD")] = "b'alma";
  levShalem.exceptions.exactWords["דְכָל".normalize("NFD")] = "d'khol";
  levShalem.exceptions.exactWords["וַיְהִי".normalize("NFD")] = "va-y'hi";
  levShalem.exceptions.exactWords["הָיְתָה".normalize("NFD")] = "haitah";
  levShalem.exceptions.exactWords["וּלְעָלְמֵי".normalize("NFD")] = "u-l'almei";
  levShalem.exceptions.exactWords["וְלא".normalize("NFD")] = "v'lo";
  levShalem.exceptions.exactWords["וְעָרְבָה".normalize("NFD")] = "v'arvah";
  levShalem.exceptions.exactWords["וְכָל".normalize("NFD")] = "v'khol";
  levShalem.exceptions.exactWords["וֵאלהֵי".normalize("NFD")] = "ve-Elohei";
  // These are lexical vav words, not the conjunction.
  levShalem.exceptions.exactWords["וְלָד".normalize("NFD")] = "v'lad";
  levShalem.exceptions.exactWords["וָו".normalize("NFD")] = "vav";
  levShalem.exceptions.exactWords["וֶרֶד".normalize("NFD")] = "vered";
  levShalem.exceptions.exactWords["הָרָה".normalize("NFD")] = "harah";
  levShalem.exceptions.exactWords["כְּכָל".normalize("NFD")] = "k'khol";
  levShalem.exceptions.exactWords["תְּהַלֵּל".normalize("NFD")] = "t'hallel";
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
  mishkanTefilah.exceptions.niqqudless["מיהוה"] = "mei-Adonai";
  mishkanTefilah.exceptions.niqqudless["ומיהוה"] = "u-mei-Adonai";
  mishkanTefilah.exceptions.niqqudless["וליהוה"] = "v'ladonai";
  mishkanTefilah.exceptions.exactWords["דְכָל".normalize("NFD")] = "d'chol";
  mishkanTefilah.exceptions.exactWords["אֱלֹהֵיכֶם".normalize("NFD")] = "Eloheichem";
  mishkanTefilah.exceptions.exactWords["אֱלֹהֵיכֶן".normalize("NFD")] = "Eloheichen";
  mishkanTefilah.exceptions.exactWords["הָאֵל".normalize("NFD")] = "ha-el";
  mishkanTefilah.exceptions.exactWords["וַיְהִי".normalize("NFD")] = "vay'hi";
  mishkanTefilah.exceptions.exactWords["הָיְתָה".normalize("NFD")] = "hay'tah";
  mishkanTefilah.exceptions.exactWords["וְלא".normalize("NFD")] = "v'lo";
  mishkanTefilah.exceptions.exactWords["וְכָל".normalize("NFD")] = "v'chol";
  mishkanTefilah.exceptions.exactWords["כְּכָל".normalize("NFD")] = "k'chol";

  // Private source style for English text-to-speech. It is deliberately
  // excluded from `all`, so it never appears in the visible style menu.
  const speechEnglish = clone(modernSefardi);
  speechEnglish.id = "speechEnglish";
  speechEnglish.name = "Speech (English)";
  speechEnglish.vowels.tzere = "ei";
  speechEnglish.vowels.vocalSheva = "e";
  speechEnglish.output.maqafSeparator = " ";
  speechEnglish.output.dashedInitialPrefixes = [];
  speechEnglish.output.doubleDageshChazak = false;

  window.HebrewRulesets.modernSefardi = modernSefardi;
  window.HebrewRulesets.levShalem = levShalem;
  window.HebrewRulesets.mishkanTefilah = mishkanTefilah;
  window.HebrewRulesets.speechEnglish = speechEnglish;
  window.HebrewRulesets.all = [
    modernSefardi,
    levShalem,
    mishkanTefilah
  ];
})();
