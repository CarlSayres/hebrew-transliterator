const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.resolve(__dirname, "..");
const context = {
  window: {}
};

vm.createContext(context);

for (const file of [
  "site/rulesets/morphhb-silent-initial-mem-sheva.js",
  "site/rulesets/wikidata-silent-initial-mem-sheva.js",
  "site/rulesets/other-prefix-silent-initial-sheva.js",
  "site/rulesets/modern-sefardi.js",
  "site/transliterator.js"
]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

const transliterator = new context.window.HebrewTransliterator.Transliterator(
  context.window.HebrewRulesets.modernSefardi
);

const cases = [
  ["שָׁלוֹם", "Shalom"],
  ["שלום", "שלום"],
  ["בָּרוּךְ מלך", "Barukh מלך"],
  ["כּל", "Kol"],
  ["כל", "Khol"],
  ["לא", "Lo"],
  ["לו", "Lo"],
  ["וְלא", "Velo"],
  ["ולו", "Velo"],
  ["וכל", "Vekhol"],
  ["וכּל", "Vekol"],
  ["טוב", "Tov"],
  ["עושה", "Oseh"],
  ["בו", "Bo"],
  ["בוֹ", "Vo"],
  ["כִּי בוֹ", "Ki vo"],
  ["או", "O"],
  ["הוד", "Hod"],
  ["אור", "Or"],
  ["בְּרֵאשִׁית", "Bereshit"],
  ["וְדָוִד", "Vedavid"],
  ["וּמֹשֶׁה", "Umosheh"],
  ["וּמְקַיֵּם", "Um·kayem"],
  ["וּנְשַׁבֵּחֲךָ", "Un·shabeḥakha"],
  ["וּֽבְשׇׁכְבְּךָ֖", "Uv·shokhbekha"],
  ["וֶ֝אֱמ֥וּנָתְךָ֗", "Ve·emunatekha"],
  ["אֱמוּנָתְכֶם", "Emunatekhem"],
  ["אֱמוּנָתְכֶן", "Emunatekhen"],
  ["אֶתְךָ", "Etkha"],
  ["אֶתְכֶם", "Etkhem"],
  ["אֶתְכֶן", "Etkhen"],
  ["וַיְהִי", "Vayehi"],
  ["וַיְכֻלּ֛וּ", "Vayekhulu"],
  ["שֶׁנִּצְטַוּוּ", "Shenitztavu"],
  ["נָתָתָּ", "Natata"],
  ["מִשְׁנֶ֔ה", "Mishneh"],
  ["מִשְׂגָּב", "Misgav"],
  ["מִזְבֵּחַ", "Mizbeaḥ"],
  ["מִזְבְּחוֹת", "Mizbeḥot"],
  ["מִנְחָה", "Minḥah"],
  ["מִנְחוֹת", "Minḥot"],
  ["מִצְרַיִם", "Mitzrayim"],
  ["מִצְרָיְמָה", "Mitzraymah"],
  ["מִצְרָֽיְמָה", "Mitzraymah"],
  ["חָיְתָה", "Ḥaytah"],
  ["וּבְמֹפְתִֽים", "Uv·mofetim"],
  ["מִקְנֶה", "Mikneh"],
  ["מִקְנִים", "Miknim"],
  ["מִשְׁנָה", "Mishnah"],
  ["מִשְׁנָיוֹת", "Mishnayot"],
  ["מִשְׁפָּט", "Mishpat"],
  ["מִלְחָמָה", "Milḥamah"],
  ["מִלְחָמוֹת", "Milḥamot"],
  ["מִסְעָדָה", "Mis·adah"],
  ["מִכְנָסַיִם", "Mikhnasayim"],
  ["מִגְּנָה", "Migenah"],
  ["כַּסְפִּית", "Kaspit"],
  ["כַּלְכָּלָה", "Kalkalah"],
  ["בַּרְזֶל", "Barzel"],
  ["בַּקְבּוּק", "Bakbuk"],
  ["לַחְמָנִיָּה", "Laḥmaniyah"],
  ["הַבְדָּלָה", "Havdalah"],
  ["שֶׁנְהָב", "Shenhav"],
  ["מִשְׁפַּחַת", "Mishpaḥat"],
  ["מִזְמוֹר", "Mizmor"],
  ["מִדְבָּר", "Midbar"],
  ["מִשְׁכָּן", "Mishkan"],
  ["מִשְׁתֶּה", "Mishteh"],
  ["מִשְׁתִּים", "Mishtim"],
  ["מִשְׁגֶּה", "Mishgeh"],
  ["מִשְׁגִּים", "Mishgim"],
  ["מִשְׂגַּבִּים", "Misgabim"],
  ["מִצְוָה", "Mitzvah"],
  ["מִצְוֹת", "Mitzvot"],
  ["יָדָֽעְתִּי", "Yadati"],
  ["שָׁמַרְתִּי", "Shamarti"],
  ["שָׁמַרְתָּ", "Shamarta"],
  ["שָׁמַרְתְּ", "Shamart"],
  ["שָׁמַרְנוּ", "Shamarnu"],
  ["שָׁמַרְתֶּם", "Shamartem"],
  ["שָׁמַרְתֶּן", "Shamarten"],
  ["וּנְתָנָ֞ם", "Un·tanam"],
  ["וּֽזְהַ֛ב", "Uzehav"],
  ["כַּבְרָכָה", "Kaverakhah"],
  ["מִבְרָכָה", "Miverakhah"],
  ["שֶׁבְרָכָה", "Sheverakhah"],
  ["בַּבְרָכָה", "Baverakhah"],
  ["לַבְרָכָה", "Laverakhah"],
  ["הַבְרָכָה", "Haverakhah"],
  ["כָּל", "Kol"],
  ["כָל", "Kol"],
  ["כְּכָל", "Kekhol"],
  ["מִן", "Min"],
  ["חָכְמָה", "Ḥokhmah"],
  ["וַאֲבָרְכָה", "Va·avarekhah"],
  ["אֲבָרְכֶֽךָּ", "Avarekheka"],
  ["קָרְבָּן", "Korban"],
  ["שָׁרְצוּ", "Sharetzu"],
  ["נָפְלוּ", "Nafelu"],
  ["גָּבְרוּ", "Gaveru"],
  ["יָצְאוּ", "Yatze·u"],
  ["יָזְמוּ", "Yazemu"],
  ["וְאָמְרוּ", "Ve·ameru"],
  ["וְהָרְגוּ", "Veharegu"],
  ["הָרְגוּ", "Haregu"],
  ["עָבְדוּ", "Avedu"],
  ["יִמָּצְאוּן", "Yimatze·un"],
  ["גָּזְלוּ", "Gazelu"],
  ["וַיִּשָּׁבְעוּ", "Vayishave·u"],
  ["וְיָלְדוּ", "Veyaledu"],
  ["וַיִּוָּלְדוּ", "Vayivaledu"],
  ["מָלְאוּ", "Male·u"],
  ["מָלְכוּ", "Malekhu"],
  ["נָסְעוּ", "Nase·u"],
  ["מָכְרוּ", "Makheru"],
  ["לָקְחוּ", "Lakeḥu"],
  ["כָּבְדוּ", "Kavedu"],
  ["יִקָּרְאוּ", "Yikare·u"],
  ["הִקָּבְצוּ", "Hikavetzu"],
  ["קָבְרוּ", "Kaveru"],
  ["עָזְבוּ", "Azevu"],
  ["וָמָתְנוּ", "Vamatnu"],
  ["פָּשְׁטוּ", "Pashetu"],
  ["יָרְאָה", "Yare·ah"],
  ["נָבְלָה", "Navelah"],
  ["שָׁכְנָה", "Shakhenah"],
  ["בָּרְחוּ", "Bareḥu"],
  ["הַדָּבְרַת", "Hadaverat"],
  ["הָרְמָחִים", "Haremaḥim"],
  ["וּבָרְמָחִים", "Uvaremaḥim"],
  ["וְהָרְעָלוֹת", "Vehare·alot"],
  ["וַיִּנָּגְעוּ", "Vayinage·u"],
  ["וְנִוָּכְחָה", "Venivakheḥah"],
  ["חָנְטָה", "Ḥanetah"],
  ["כָּפְנָה", "Kafenah"],
  ["לָרְוָיָה", "Larevayah"],
  ["סָגְרוּ", "Sageru"],
  ["עָתְקָה", "Atekah"],
  ["פָּתְחוּ", "Pateḥu"],
  ["שָׁבְרָה", "Shaverah"],
  ["שָׁכְרוּ", "Shakheru"],
  ["תֵּחָלְצוּ", "Teḥaletzu"],
  ["תּוֹלְדֹת", "Toledot"],
  ["כְּכוֹכְבֵי", "Kekhokhevei"],
  ["עוֹדְךָ", "Odekha"],
  ["לִקְרָאתוֹ", "Likra·to"],
  ["עַל־צַוָּארוֹ", "Al-tzava·ro"],
  ["תְּנוּ", "Tenu"],
  ["יִתְּנוּ", "Yitenu"],
  ["וַיִּתְּנוּ", "Vayitenu"],
  ["יִשְׁמְרוּ", "Yishmeru"],
  ["הִנְנִי", "Hineni"],
  ["חָנֵּֽנוּ", "Ḥonenu"],
  ["צׇהֳרָֽיִם", "Tzohorayim"],
  ["קָדְשִׁי", "Kodshi"],
  ["קָֽדְשִׁי", "Kadeshi"],
  ["קָ֣דְשִׁי", "Kadeshi"],
  ["אׇֽהֳלֹה", "Oholoh"],
  ["קָדְשְׁ֒ךָ", "Kodshekha"],
  ["דָּבָר", "Davar"],
  ["וָדָּֽעַת", "Vada·at"],
  ["וּבָרוּךְ", "Uvarukh"],
  ["הֹוֶה", "Hoveh"],
  ["רִאשׁון", "Rishon"],
  ["אֵינו", "Eino"],
  ["אֲדון", "Adon"],
  ["עולָם", "Olam"],
  ["נוצָר", "Notzar"],
  ["יורֶה", "Yoreh"],
  ["גְדֻלָּתו", "Gedulato"],
  ["מַלְכוּתו", "Malkhuto"],
  ["קָו", "Kav"],
  ["סוף", "Sof"],
  ["גדֶל", "Godel"],
  ["אֲדנָי שפָתַי תִּפְתָּח", "Adonai sefatay tiftaḥ"],
  ["לֵאלהֵינוּ", "Leloheinu"],
  ["וֵאלהֵי אֲבותֵינוּ", "Ve·elohei avoteinu"],
  ["וֵאלהֵי יַעֲקב", "Ve·elohei yaakov"],
  ["הַגָּדול הַגִּבּור וְהַנּורָא", "Hagadol hagibor vehanora"],
  ["אֵל עֶלְיון", "El elyon"],
  ["וְקונֵה הַכּל", "Vekoneh hakol"],
  ["וְזוכֵר חַסְדֵי אָבות", "Vezokher ḥasdei avot"],
  ["מֶלֶךְ עוזֵר וּמושִׁיעַ וּמָגֵן", "Melekh ozer umoshia umagen"],
  ["אֲנָֽחְנוּ", "Anaḥnu"],
  ["פָשָֽׁעְנוּ", "Fashanu"],
  ["גָּאָֽלְתָּ", "Ga·alta"],
  ["עָרְבָה", "Arvah"],
  ["וְעָרְבָה", "Ve·arvah"],
  ["וְעָרְבָה לה' מִנְחַת יְהוּדָה וִירוּשָׁלָיִם", "Ve·arvah Ladonai minḥat yehudah virushalayim"],
  ["סֶּֽלָה", "Selah"],
  ["לַשָּׁ֣וְא", "Lashav"],
  ["רָֽאשֵׁיכֶ֗ם", "Ra·sheikhem"],
  ["מְלַאכְתּ֖וֹ", "Melakhto"],
  ["הִ֖וא", "Hi"],
  ["הֽוּא", "Hu"],
  ["הַהִ֖וא", "Hahi"],
  ["הָיְתָ֥ה", "Hayetah"],
  ["שְׁתַּיִם", "Shtayim"],
  ["שְׁתֵּי", "Shtei"],
  ["יִשרָאֵל", "Yisrael"],
  ["בְּיִשרָאֵל", "Beyisrael"],
  ["בְּעָלְמָא", "Be·alma"],
  ["וּלְעָלְמֵי", "Ul·almei"],
  ["וּלְעֽוֹלְמֵי", "Ul·olemei"],
  ["עָלְמַיָּא", "Almaya"],
  ["דְכָל", "Dekhol"],
  ["הַלְ֒לוּיָהּ", "Haleluyaḣ"],
  ["עָלְ֒מַיָּא", "Alemaya"],
  ["לְעֵֽלָּא", "Le·ela"],
  ["ככָּל", "Khkol"],
  ["ככָל", "Khkol"],
  ["לכָּל", "Lkol"],
  ["לכָל", "Lkol"],
  ["הכָּל", "Hkol"],
  ["הכָל", "Hkol"],
  ["מִכָּל", "Mikol"],
  ["מִכָל", "Mikol"],
  ["בכָּל", "Vkol"],
  ["בכָל", "Vkol"],
  ["בְּכָּל", "Bekhol"],
  ["בְּכָל", "Bekhol"],
  ["וּבְכָּל", "Uv·khol"],
  ["וּבְכָל", "Uv·khol"],
  ["וּבְכׇּל", "Uv·khol"],
  ["וּבְכׇל", "Uv·khol"],
  ["שכָּל", "Shkol"],
  ["שכָל", "Shkol"],
  ["וְכָּל", "Vekhol"],
  ["וְכָל", "Vekhol"],
  ["שֶׁבְּ֒כָל", "Shebekhol"],
  ["שֶׁכָּל", "Shekol"],
  ["יָבֹֽאוּ", "Yavo·u"],
  ["רְאוּבֵ֣ן", "Re·uven"],
  ["בִּמְאֹ֣ד", "Bim·od"],
  ["יִשָּׂשכָר", "Yissakhar"],
  ["מִקְדָּשׁ", "Mikdash"],
  ["מִצִּיּוֹן", "Mitziyon"],
  ["בַּיּוֹם", "Bayom"],
  ["רוּחַ", "Ruaḥ"],
  ["מָשִׁיחַ", "Mashiaḥ"],
  ["נֹחַ", "Noaḥ"],
  ["תּוֹרָה", "Torah"],
  ["לָהּ", "Laḣ"],
  ["סוֹמֵךְ", "Somekh"],
  ["עֲלֵיכֶם", "Aleikhem"],
  ["כָּל־הָאָרֶץ", "Kol-ha·aretz"],
  ["אֶ֯ל־משֶׁה", "El-mosheh"],
  ["אֶ֯ת־כָּל־מִצְוֹתָי", "Et-kol-mitzvotay"],
  ["וּבְכָל־נַפְשְׁ֒ךָ", "Uv·khol-nafshekha"],
  ["בְּכׇל־לְבָבְךָ֥", "Bekhol-levavekha"],
  ["לְבָבְכֶם", "Levavekhem"],
  ["לְבָבְכֶן", "Levavekhen"],
  ["בְּכָל֯־לְ֯בָבְ֒ךָ וּבְכָל־נַפְשְׁ֒ךָ וּבְכָל־מְאֹדֶֽךָ:", "Bekhol-levavekha uv·khol-nafshekha uv·khol-me·odekha:"],
  ["וְאָ֣הַבְתָּ֔ אֵ֖ת יְהֹוָ֣ה אֱלֹהֶ֑יךָ בְּכׇל־לְבָבְךָ֥", "Ve·ahavta et Adonai Elohekha bekhol-levavekha"],
  ["בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ", "Barukh Atah Adonai Eloheinu"],
  ["בָּרוּךְ ה׳", "Barukh Adonai"],
  ["בָּרוּךְ ה'", "Barukh Adonai"],
  ["בָּרוּךְ ה’", "Barukh Adonai"],
  ["בָּרוּךְ 'ה", "Barukh Adonai"],
  ["בָּרוּךְ ׳ה", "Barukh Adonai"],
  ["בָּרוּךְ ’ה", "Barukh Adonai"],
  ["וְעִם רוּחִי גְּוִיָּתִי. ה' לִי וְלא אִירָא:", "Ve·im ruḥi geviyati. Adonai li velo ira:"],
  ["לה'", "Ladonai"],
  ["שָׁלוֹם בָּרוּךְ אַתָּה", "Shalom barukh Atah"],
  ["אֱלֹהֵי", "Elohei"],
  ["אֱלהִים", "Elohim"],
  ["לֵאלֹהִֽים", "Lelohim"],
  ["אֱלֹהָי", "Elohai"],
  ["אֱלֹהַי", "Elohai"],
  ["אֱלֹהֶיךָ", "Elohekha"],
  ["אֱלֹהֵיכֶם", "Eloheikhem"],
  ["אֱלֹהֵיכֶן", "Eloheikhen"],
  ["אֱלֹהֶיהָ", "Eloheha"],
  ["אֱלֹהֵיהֶם", "Eloheihem"],
  ["אֱלֹהֵיהֶן", "Eloheihen"],
  ["אֱלוֹהַּ", "Eloah"],
  ["אֲדֹנֵינוּ", "Adoneinu"],
  ["שֶׁיְהֹוָה", "She·Adonai"],
  ["לָיְלָה", "Lailah"],
  ["לַֽיהֹוָ֔ה", "Ladonai"],
  ["לַיהוָֹה", "Ladonai"],
  ["לַייָ", "Ladonai"],
  ["בַּֽיהֹוָ֔ה", "Badonai"],
  ["כַּיהֹוָ֖ה", "Kadonai"],
  ["כֵּאלֹהֵֽינוּ", "Keloheinu"],
  ["כַּאדונֵינוּ", "Kadoneinu"],
  ["פָּנָיו", "Panav"],
  ["וְהָיוּ", "Vehayu"],
  ["הָאֵֽלֶּה", "Ha·eleh"],
  ["מְצַוְּ֒ךָ", "Metzavekha"],
  ["מִלְּ֒פָנֶֽיךָ", "Milefanekha"],
  ["בִּישׁוּעָתְ֒ךָ", "Bishu·atekha"],
  ["אֱלוֹהַי", "Elohai"],
  ["אֱלֹהָיו", "Elohav"],
  ["הָעָם", "Ha·am"],
  ["וָעֶד", "Va·ed"],
  ["וַאֲנַֽחְנוּ", "Va·anaḥnu"],
  ["אֶיךְ", "Ekh"],
  ["לְשָׁלוֹם", "Leshalom"],
  ["בְּרֵאשִׁית, שָׁלוֹם.\nכָּל־הָאָרֶץ׃", "Bereshit, shalom.\nKol-ha·aretz:"],
  ["שָׁלוֹם׀ לָךְ", "Shalom lakh"],
  ["שָׁלוֹם. וְדָוִד׃ לְשָׁלוֹם", "Shalom. Vedavid: Leshalom"]
];

const failures = [];

for (const [input, expected] of cases) {
  const actual = transliterator.transliterate(input);
  if (actual !== expected) {
    failures.push({ input, expected, actual });
  }
}

const unvocalizedWordCases = [
  ["שלום", ["שלום"]],
  ["בָּרוּךְ מלך", ["מלך"]],
  ["יהוה", []],
  ["טוב עושה בו או הוד אור", []],
  ["ה'", []],
  ["'ה", []]
];

for (const [input, expected] of unvocalizedWordCases) {
  const actual = transliterator.unvocalizedWords(input);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push({ input, expected, actual, feature: "unvocalizedWords" });
  }
}

const styleCases = [
  [
    "levShalem",
    [
      ["בְּרֵאשִׁית", "B'reshit"],
      ["וּמֹשֶׁה", "U-mosheh"],
      ["וּבְמֹפְתִֽים", "U-v'mof'tim"],
      ["וָבֶטַח", "Va-vetaḥ"],
      ["וְדָוִד", "Ve-david"],
      ["וֶאֱמוּנָה", "Ve-emunah"],
      ["וַאֲנַֽחְנוּ", "Va-anaḥnu"],
      ["וְלָד", "V'lad"],
      ["וָו", "Vav"],
      ["וֶרֶד", "Vered"],
      ["וּֽזְהַ֛ב", "U-z'hav"],
      ["וַיְהִי", "Vay'hi"],
      ["הָיְתָ֥ה", "Hay'tah"],
      ["הַמֶּלֶךְ", "Ha-melekh"],
      ["שֶׁבְרָכָה", "She-v'rakhah"],
      ["בַּבְרָכָה", "Ba-v'rakhah"],
      ["בָּאָרֶץ", "Ba-aretz"],
      ["לַעֲשׂוֹת בָּאָרֶץ", "La-asot ba-aretz"],
      ["לַבְרָכָה", "La-v'rakhah"],
      ["מִבְרָכָה", "Mi-v'rakhah"],
      ["מִֽי־כָמֹ֤כָה בָּֽאֵלִם֙ יְהֹוָ֔ה        מִ֥י כָּמֹ֖כָה נֶאְדָּ֣ר בַּקֹּ֑דֶשׁ", "Mi-khamokhah ba-elim Adonai        mi kamokhah nedar ba-kodesh"],
      ["בְּעָלְמָא", "B'alma"],
      ["וּלְעָלְמֵי", "U-l·almei"],
      ["וּלְעֽוֹלְמֵי", "U-l·ol'mei"],
      ["דְכָל", "D'khol"],
      ["לְבָבְךָ", "L'vav'kha"],
      ["לְבָבְכֶם", "L'vav'khem"],
      ["לְבָבְכֶן", "L'vav'khen"],
      ["לָהּ", "Lah"],
      ["הַלְ֒לוּיָהּ", "Ha-l'luyah"],
      ["הָעָם", "Ha·am"],
      ["רְאוּבֵ֣ן", "R'uven"],
      ["שֶׁיְהֹוָה", "She-Adonai"]
      ,
      ["וּמְקַיֵּם", "U-m'kayem"]
      ,
      ["וּנְשַׁבֵּחֲךָ", "U-n'shabeḥakha"],
      ["וּבְכָל", "U-v'khol"],
      ["שֶׁבְּ֒כָל", "She-b'khol"],
      ["שֶׁכָּל", "She-kol"],
      ["וְלא", "Ve-lo"]
      ,
      ["כְּכָל", "K'khol"],
      ["מִן", "Min"]
      ,
      ["מִלְחָמָה", "Milḥamah"],
      ["מִלְחָמוֹת", "Milḥamot"]
      ,
      ["מִסְעָדָה", "Mis·adah"],
      ["מִכְנָסַיִם", "Mikhnasayim"],
      ["מִפְּנֵי", "Mi-p'nei"],
      ["מִמְּךָ", "Mi-m'kha"]
      ,
      ["מִגְּנָה", "Mi-g'nah"]
      ,
      ["כַּסְפִּית", "Kaspit"],
      ["כַּלְכָּלָה", "Kalkalah"],
      ["בַּרְזֶל", "Barzel"],
      ["בַּקְבּוּק", "Bakbuk"],
      ["לַחְמָנִיָּה", "Laḥmaniyah"],
      ["הַבְדָּלָה", "Havdalah"],
      ["שֶׁנְהָב", "Shenhav"]
      ,
      ["שָׁרְצוּ", "Shar'tzu"]
      ,
      ["תּוֹלְדֹת", "Tol'dot"],
      ["כְּכוֹכְבֵי", "K'khokh'vei"],
      ["עוֹדְךָ", "Od'kha"],
      ["לִקְרָאתוֹ", "Likra'to"],
      ["עַל־צַוָּארוֹ", "Al-tzava'ro"]
      ,
      ["תְּנוּ", "T'nu"],
      ["יִתְּנוּ", "Yit'nu"],
      ["וַיִּתְּנוּ", "Vayit'nu"]
    ]
  ],
  [
    "mishkanTefilah",
    [
      ["וּבְמֹפְתִֽים", "Uv-mof'tim"],
      ["שֶׁבְּ֒כָל", "Sheb'chol"],
      ["שֶׁכָּל", "Shekol"],
      ["חָכְמָה", "Chochmah"],
      ["בְּרֵאשִׁית", "B'reishit"],
      ["חֵי", "Chei"],
      ["הָעָם", "Ha-am"],
      ["כָּל־הָאָרֶץ", "Kol-ha-aretz"],
      ["רָֽאשֵׁיכֶ֗ם", "Ra-sheichem"],
      ["רְאוּבֵ֣ן", "R'uvein"],
      ["לְבָבְךָ", "L'vav'cha"],
      ["לְבָבְכֶם", "L'vav'chem"],
      ["לְבָבְכֶן", "L'vav'chen"],
      ["אֱלֹהֵיכֶם", "Eloheichem"],
      ["אֱלֹהֵיכֶן", "Eloheichen"],
      ["הָאֵל", "Ha-el"],
      ["וַיְהִי", "Vay'hi"],
      ["הָיְתָ֥ה", "Hay'tah"],
      ["בְּעָלְמָא", "B'alma"],
      ["דְכָל", "D'chol"],
      ["וּלְעֽוֹלְמֵי", "Ul-ol'mei"],
      ["אֶתְכֶם", "Etchem"],
      ["בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ", "Baruch Atah Adonai Eloheinu"],
      ["וּמְקַיֵּם", "Um-kayeim"],
      ["וּנְשַׁבֵּחֲךָ", "Un-shabeichacha"],
      ["וּבְכָל", "Uv-chol"],
      ["כְּכָל", "K'chol"],
      ["מִן", "Min"],
      ["מִלְחָמָה", "Milchamah"],
      ["מִלְחָמוֹת", "Milchamot"],
      ["מִסְעָדָה", "Mis-adah"],
      ["מִכְנָסַיִם", "Michnasayim"],
      ["כַּסְפִּית", "Kaspit"],
      ["כַּלְכָּלָה", "Kalkalah"],
      ["בַּרְזֶל", "Barzel"],
      ["בַּקְבּוּק", "Bakbuk"],
      ["לַחְמָנִיָּה", "Lachmaniyah"],
      ["הַבְדָּלָה", "Havdalah"],
      ["שֶׁנְהָב", "Shenhav"],
      ["שָׁרְצוּ", "Shar'tzu"],
      ["תּוֹלְדֹת", "Tol'dot"],
      ["כְּכוֹכְבֵי", "K'choch'vei"],
      ["עוֹדְךָ", "Od'cha"],
      ["לִקְרָאתוֹ", "Likra-to"],
      ["עַל־צַוָּארוֹ", "Al-tzava-ro"],
      ["תְּנוּ", "T'nu"],
      ["יִתְּנוּ", "Yit'nu"],
      ["וַיִּתְּנוּ", "Vayit'nu"],
      ["כל", "Chol"],
      ["וכל", "Vechol"],
      ["וכּל", "Vekol"],
      ["וְלא", "V'lo"]
    ]
  ]
];

for (const [rulesetId, styleExamples] of styleCases) {
  const styleTransliterator = new context.window.HebrewTransliterator.Transliterator(
    context.window.HebrewRulesets[rulesetId]
  );

  for (const [input, expected] of styleExamples) {
    const actual = styleTransliterator.transliterate(input);
    if (actual !== expected) {
      failures.push({ rulesetId, input, expected, actual });
    }
  }
}

const doubledDageshRuleset = JSON.parse(JSON.stringify(context.window.HebrewRulesets.modernSefardi));
doubledDageshRuleset.output.doubleDageshChazak = true;
const doubledDageshTransliterator = new context.window.HebrewTransliterator.Transliterator(doubledDageshRuleset);
const doubledDageshCases = [
  ["בָּא", "Ba"],
  ["הַמֶּלֶךְ", "Hammelekh"],
  ["וָדָּֽעַת", "Vada·at"],
  ["וַיֹּאמֶר", "Vayyomer"],
  ["בַּיּוֹם", "Bayyom"],
  ["הַשֵּׁם", "Hashem"],
  ["הַצַּדִּיק", "Hatzaddik"],
  ["יָדָֽעְתִּי", "Yadati"],
  ["שֶׁנִּצְטַוּוּ", "Shennitztavvu"],
  ["מְצַוְּ֒ךָ", "Metzavvekha"],
  ["לָךּ", "Lak"]
];

for (const [input, expected] of doubledDageshCases) {
  const actual = doubledDageshTransliterator.transliterate(input);
  if (actual !== expected) {
    failures.push({ modifier: "doubleDageshChazak", input, expected, actual });
  }
}

const levShalemDoubledDageshRuleset = JSON.parse(JSON.stringify(context.window.HebrewRulesets.levShalem));
levShalemDoubledDageshRuleset.output.doubleDageshChazak = true;
const levShalemDoubledDageshTransliterator = new context.window.HebrewTransliterator.Transliterator(
  levShalemDoubledDageshRuleset
);
const levShalemDoubledDageshCases = [
  ["הַמֶּלֶךְ", "Ha-melekh"],
  ["בַּבְּרָכָה", "Ba-b'rakhah"],
  ["לַבְּרָכָה", "La-b'rakhah"]
];

for (const [input, expected] of levShalemDoubledDageshCases) {
  const actual = levShalemDoubledDageshTransliterator.transliterate(input);
  if (actual !== expected) {
    failures.push({ modifier: "levShalemDoubleDageshChazak", input, expected, actual });
  }
}

const stressMarkCases = [
  ["דָּבָר", "Davar"],
  ["הָאֵֽלֶּה", "Ha·éleh"],
  ["מִלְּ֒פָנֶֽיךָ", "Milefanékha"],
  ["בִּשְׁבָחוֹת", "Bishvaḥot"],
  ["בִּשְׁבָחוֹת וּבִזְמִירוֹת", "Bishvaḥot uvizmirot"],
  ["יִתְר֛וֹ", "Yitro"],
  ["חֹתְנ֖וֹ", "Ḥoteno"],
  ["מִתּ֣וֹךְ", "Mitokh"],
  ["אֶל־הַר", "El-har"],
  ["לַבַּת־אֵשׁ", "Labat-esh"],
  ["אָסֻרָה־נָּא", "Asurah-na"],
  ["כָּל־הָאָרֶץ", "Kol-ha·aretz"],
  ["בָּרוּךְ אַתָּה יְיָ", "Barukh Atah Adonai"],
  ["אֱלֹהֵינוּ", "Elohéinu"],
  ["אֱלֹהֶ֑יךָ", "Elohékha"],
  ["אֱלֹהֶ֜יךָ", "Elohékha"],
  ["אֲנָֽחְנוּ", "Anáḥnu"],
  ["גָּאָֽלְתָּ", "Ga·álta"],
  ["וְאָ֣הַבְתָּ֔", "Ve·áhavtá"],
  ["וּבְבֵיתֶ֙ךָ֙", "Uveveitékha"],
  ["תַּֽדְשֵׁ֤א", "Tádshé"],
  ["עֹֽשֶׂה־פְּרִ֛י", "Óseh-perí"],
  ["וַֽיְהִי־אֽוֹר", "Váyehi-ór"],
  ["הַיּ֖וֹם", "Hayom"],
  ["הַמְּ֒לָכִים", "Hamelakhim"],
  ["וּנְשַׁבֵּחֲךָ", "Un·shabeḥakha"],
  ["נְשַׁבֵּחֲךָ", "Neshabeḥakha"],
  ["וּנְפָאֶרְךָ", "Un·fa·erkha"],
  ["נְפָאֶרְךָ", "Nefa·erkha"],
  ["וְנַמְלִיכְךָ", "Venamlikhekha"],
  ["נַמְלִיכְךָ", "Namlikhekha"],
  ["יִשרָאֵל", "Yisrael"],
  ["שלום <test>", "שלום <test>"]
];

for (const [input, expected] of stressMarkCases) {
  const actual = transliterator.transliterateWithStressMarks(input);
  if (actual !== expected) {
    failures.push({ feature: "stressMarks", input, expected, actual });
  }
}

const unicodeNormalizationCases = [
  // Canonical ordering permits vowel and consonant-dot marks to arrive in
  // either order. Both forms must produce identical transliteration.
  ["שָׁלוֹם", "Shalom"],
  ["בָּרוּךְ", "Barukh"],
  // The same applies when a vowel and meteg are reversed on one letter.
  ["הָאֵֽלֶּה", "Ha·eleh"],
  // Sefaria occasionally includes an invisible combining grapheme joiner.
  ["יִשְׂרָאֵ֑͏ֽל", "Yisra·el"]
];

for (const [input, expected] of unicodeNormalizationCases) {
  const actual = transliterator.transliterate(input);
  if (actual !== expected) {
    failures.push({ feature: "unicodeNormalization", input, expected, actual });
  }
}

const tzereEiRuleset = JSON.parse(JSON.stringify(context.window.HebrewRulesets.modernSefardi));
tzereEiRuleset.vowels.tzere = "ei";
const tzereEiTransliterator = new context.window.HebrewTransliterator.Transliterator(tzereEiRuleset);
const tzereOverrideCases = [
  ["רְאוּבֵ֣ן", "Re·uvein"]
];

for (const [input, expected] of tzereOverrideCases) {
  const actual = tzereEiTransliterator.transliterate(input);
  if (actual !== expected) {
    failures.push({ modifier: "tzereOverride", input, expected, actual });
  }
}

const consonantOverrideRuleset = JSON.parse(JSON.stringify(context.window.HebrewRulesets.modernSefardi));
consonantOverrideRuleset.consonants["ח"] = "ch";
consonantOverrideRuleset.consonants["כ"].plain = "ch";
consonantOverrideRuleset.consonants["ך"].plain = "ch";
const consonantOverrideTransliterator = new context.window.HebrewTransliterator.Transliterator(consonantOverrideRuleset);
const consonantOverrideCases = [
  ["חֵי", "Chei"],
  ["מֶלֶךְ", "Melech"],
  ["מִנְחָה", "Minchah"]
];

for (const [input, expected] of consonantOverrideCases) {
  const actual = consonantOverrideTransliterator.transliterate(input);
  if (actual !== expected) {
    failures.push({ modifier: "consonantOverride", input, expected, actual });
  }
}

const { assignStress, parseClusters } = context.window.HebrewTransliterator.internals;
const stressFailures = [];

function stressedBases(input, kind) {
  const clusters = parseClusters(input);
  assignStress(clusters);
  return clusters.filter((cluster) => cluster[kind]).map((cluster) => cluster.base).join("");
}

const stressCases = [
  ["דָּבָר", "primaryStress", "בר"],
  ["הָאֵֽלֶּה", "primaryStress", "א"],
  ["הָאֵֽלֶּה", "secondaryStress", ""],
  ["קָדְשְׁ֒ךָ", "primaryStress", "ך"],
  ["קָדְשְׁ֒ךָ", "secondaryStress", ""],
  ["מִלְּ֒פָנֶֽיךָ", "primaryStress", "ני"],
  ["מִלְּ֒פָנֶֽיךָ", "secondaryStress", "פ"]
];

for (const [input, kind, expected] of stressCases) {
  const actual = stressedBases(input, kind);
  if (actual !== expected) {
    stressFailures.push({ input, kind, expected, actual });
  }
}

failures.push(...stressFailures);

if (failures.length) {
  console.error("Transliteration test failures:");
  for (const failure of failures) {
    console.error(JSON.stringify(failure));
  }
  process.exit(1);
}

const styleTestCount = styleCases.reduce((sum, [, styleExamples]) => sum + styleExamples.length, 0);
console.log(`${cases.length + styleTestCount + doubledDageshCases.length + levShalemDoubledDageshCases.length + stressMarkCases.length + unicodeNormalizationCases.length + tzereOverrideCases.length + consonantOverrideCases.length + stressCases.length} transliteration tests passed.`);
