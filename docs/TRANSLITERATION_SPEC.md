# Hebrew Transliterator Specification

## 1. Purpose

This specification defines how vocalized Hebrew text is transliterated into English characters by the standalone web application.

The application accepts Hebrew text with niqqud and outputs readable transliteration according to the selected style. The goal is to use deterministic rules wherever possible, with a small exception dictionary only for cases that cannot be resolved from the written form.

## 2. Transliteration Style

Default pronunciation style:

- Modern Sephardi readable pronunciation.
- Output is lowercase by default, except the first letter of the output, a new line, or text following a period or colon is capitalized.
- Sacred names and recognized liturgical phrase forms may be capitalized.
- Dagesh chazak affects analysis; an optional checkbox can also double the consonant in output.

The page offers selectable output styles:

| Style | Main Differences |
|---|---|
| Modern Sephardi | Baseline style. Vocal sh'va is `e`; khaf is `kh`; vowel-vowel and selected consonant boundaries use `·`; mappiq heh is `ḣ`. |
| Lev Shalem | Based on Modern Sephardi. Vocal sh'va is an apostrophe after the consonant; conjunctive shuruk is `u-`; prefixes `she-`, `ba-`, `la-`, `mi-`, and `ha-` use a dash; mappiq heh is plain `h`; vowel-vowel boundaries use `·`; selected consonant boundaries use apostrophe. |
| Mishkan Tefilah | Based on Modern Sephardi. Khaf and chet are `ch`; tzeire is `ei`; vocal sh'va is an apostrophe after the consonant; vowel-vowel boundaries and selected consonant boundaries use `-`. |

Optional modifiers:

| Modifier | Effect |
|---|---|
| Double dagesh chazak | Doubles the output consonant for dagesh chazak while preserving the selected base style. |
| Stress marks | Adds an acute accent mark only where stress guidance is useful: non-final stress, true double accents, or known unmarked liturgical stress overrides. Ordinary final stress and one-syllable words are left unmarked. |
| Tzere `e` / `ei` | Overrides the selected style's plain tzere output. Tzere-yod remains `ei`. |
| ח output | Overrides the selected style's chet output; choices include `h`, `ḥ`, `ch`, and `kh`. |
| כ / ך output | Overrides the selected style's undageshed khaf/final khaf output; choices include `h`, `ḥ`, `ch`, and `kh`. Dageshed kaf remains `k`. |

Examples:

| Hebrew | Output |
|---|---|
| מִקְדָּשׁ | Mikdash |
| בְּרֵאשִׁית | Bereshit |
| וְדָוִד | Vedavid |
| בָּרוּךְ אַתָּה יְיָ | Barukh Atah Adonai |

## 3. Text Processing Pipeline

The implementation should process text in this order:

1. Normalize Hebrew Unicode.
2. Split text into Hebrew words, maqaf-connected groups, punctuation, and whitespace.
3. Parse each Hebrew base letter with attached marks.
4. Identify consonants, vowels, dagesh/mappiq, shin/sin dots, meteg, and trope marks.
5. Detect sacred names and recognized phrase forms.
6. Preserve fully unvocalized Hebrew words unless they are known sacred-name or exact exceptions.
7. Detect stress markers using meteg and trope marks.
8. Assign primary and secondary stress.
9. Classify kamatz as kamatz gadol or kamatz katan.
10. Classify sh'va as vocal or silent.
11. Apply vowel-letter combinations.
12. Apply consonant and vowel transliteration.
13. Apply furtive patach rules.
14. Apply punctuation, maqaf, casing, and spacing rules.

## 3.1 Unvocalized Hebrew

Fully unvocalized Hebrew words are left unchanged in the output, because their vowels cannot usually be determined reliably from consonants alone.

Known exact exceptions, especially sacred-name forms such as `יהוה` or `ה׳`, may still be transliterated.

As a conservative fallback, three-letter unvocalized words with medial `ו` are assumed to contain holam-vav. For example, `הוד` -> `hod` and `אור` -> `or`. Longer unvocalized words such as `שלום` remain unchanged unless listed as safe exceptions.

When the input contains unvocalized Hebrew words that are preserved, the page displays a note so the user knows those words were not transliterated.

## 3.2 MorphHB Audit Workflow

The project includes a separate MorphHB audit script for biblical Hebrew review:

```powershell
.\parser\scripts\run-morphhb-audit.ps1 --download
```

The script downloads the Open Scriptures MorphHB `wlc` XML files into `parser/data/morphhb`, scans biblical words beginning with initial `מִ` followed by sh'va, and writes `parser/reports/morphhb-mi-sheva.md`. MorphHB lemma prefix data is used as a review hint: forms whose lemma marks `m/` as a prefix are treated as likely true `מִן` prefixes; other forms are listed as lexical candidates where the following sh'va may need to be silent.

The generated lexical lookup is rebuilt with:

```powershell
.\parser\scripts\build-morphhb-mi-sheva-list.ps1
```

It writes `site/rulesets/morphhb-silent-initial-mem-sheva.js`. The generated list includes only forms with no MorphHB `m/` prefix evidence and no `מִן` lemma (`4480`), so true prefix forms such as `מִפְּנֵי` and `מִמְּךָ` are excluded.

The Biblical list is supplemented by vocalized Hebrew lemmas and grammatical forms from Wikidata's CC0 lexicographical data. Rebuild that generated lookup with:

```powershell
node .\parser\scripts\build-wikidata-mi-sheva-list.js
```

It writes `site/rulesets/wikidata-silent-initial-mem-sheva.js`. Only single-word dictionary entries beginning with `מִ` whose next consonant carries sh'va are included. Because these are dictionary entries rather than arbitrary words found in running text, they prevent lexical words such as `מִלְחָמָה` from being mistaken for the productive `מִ־` (“from”) prefix. The general prefix rule remains active for forms absent from the lexical lookups.

## 4. Consonants

### 4.1 Basic Consonant Table

| Hebrew | Name | Output |
|---|---|---|
| א | alef | silent consonant |
| בּ | bet | b |
| ב | vet | v |
| ג | gimel | g |
| ד | dalet | d |
| ה | heh | h |
| ו | vav | v |
| ז | zayin | z |
| ח | chet | ḥ |
| ט | tet | t |
| י | yod | y |
| כּ / ךּ | kaf | k |
| כ / ך | khaf | kh |
| ל | lamed | l |
| מ / ם | mem | m |
| נ / ן | nun | n |
| ס | samekh | s |
| ע | ayin | silent consonant |
| פּ / ףּ | peh | p |
| פ / ף | feh | f |
| צ / ץ | tzadi | tz |
| ק | kuf | k |
| ר | resh | r |
| שׁ | shin | sh |
| שׂ | sin | s |
| תּ | tav with dagesh | t |
| ת | tav without dagesh | t |

### 4.2 Silent Gutturals

Alef and ayin are not marked as consonants in output. Their vowels are still pronounced.

| Hebrew | Output |
|---|---|
| עֲלֵיכֶם | aleikhem |
| אֱלֹהִים | Elohim |

### 4.3 Final Heh and Mappiq

Plain final heh is written as final `h`.

Final heh with mappiq is written as final `ḣ`.

| Hebrew | Output |
|---|---|
| תּוֹרָה | torah |
| מַלְכָּה | malkah |
| הָאֵֽלֶּה | ha·eleh |
| לָהּ | laḣ |

## 5. Vowels

### 5.1 Basic Vowel Table

| Hebrew Mark | Name | Output |
|---|---|---|
| ַ | patach | a |
| ָ | kamatz gadol | a |
| ָ | kamatz katan | o |
| ֶ | segol | e |
| ֵ | tzere | e |
| ִ | hiriq | i |
| ֹ | holam | o |
| ֻ | kubutz | u |
| ְ | vocal sh'va | e |
| ְ | silent sh'va | no output |
| ֲ | chataf patach | a |
| ֱ | chataf segol | e |
| ֳ | chataf kamatz | o |

### 5.2 Vowel-Letter Combinations

| Pattern | Output |
|---|---|
| tzere-yod | ei |
| segol-yod | e |
| patach-yod | ai |
| holam-vav | o |
| yod-holam-vav | yo |
| shared shin-dot holam before שׁ | o |
| shuruk | u |
| final yod-vav with plain vav | av |

When a consonant is followed by holam-vav or shuruk, that consonant has its own vowel and should be treated as the start of its own syllable.

When a vowel-less consonant precedes shin with shin dot, the shin dot may also serve as the holam for the preceding consonant.

When vav with holam follows a consonant with sh'va, the vav is consonantal and keeps its `v` sound.

If a mostly vocalized source omits the holam mark from holam-vav, repair a plain unmarked vav as holam-vav only when the word has other vocalization and the previous letter does not have its own vowel. This covers Sefaria forms such as `אֲדון` -> `adon`, `רִאשׁון` -> `rishon`, and `גְדֻלָּתו` -> `gedulato`. Fully unvocalized words remain unchanged, and words such as `קָו` are not repaired because the previous letter already has a vowel.

Some Sefaria liturgical texts omit holam marks or shin/sin dots in ways that cannot be inferred safely from the visible consonants. These are handled with targeted exceptions rather than a broad guessing rule. Examples include `גדֶל` -> `godel`, `שפָתַי` -> `sefatay`, `יַעֲקב` -> `yaakov`, and divine-name forms such as `אֲדנָי` -> `Adonai`.

Examples:

| Hebrew | Output |
|---|---|
| בֵּית | beit |
| חַי | ḥai |
| וּמֹשֶׁה | umosheh |

## 6. Dagesh

### 6.1 Dagesh Kal

Dagesh kal changes pronunciation for begadkefat letters where relevant:

| With Dagesh | Output | Without Dagesh | Output |
|---|---|---|---|
| בּ | b | ב | v |
| כּ / ךּ | k | כ / ך | kh |
| פּ / ףּ | p | פ / ף | f |
| תּ | t | ת | t |

### 6.2 Dagesh Chazak

Dagesh chazak affects syllable, kamatz, and sh'va analysis. When the `Double dagesh chazak` option is selected, it also produces doubled English consonants. The first and last letter of a word are never doubled in output. Shin/sin and tzadi are also not doubled in output, because doubling `sh`, `s`, or `tz` is visually awkward and less readable.

The app treats a dagesh as dagesh chazak only when it can reasonably identify a doubled consonant:

- A dagesh in the first letter of a word is not chazak.
- A dagesh in the final letter of a word is not chazak for doubling or for closing the previous kamatz syllable.
- Mappiq heh and shuruk are not chazak.
- A dagesh in a non-begadkefat letter is chazak, except for the cases above.
- A dagesh in a begadkefat letter is chazak only when the previous letter has a sounded vowel, shuruk, or vocal sh'va.
- A begadkefat dagesh after a silent sh'va is dagesh kal, not chazak.
- A begadkefat dagesh after an initial non-article proclitic boundary (`ו`, `ב`, `כ`, `ל`, or `ש`) is treated as dagesh kal.
- A dagesh after the definite article, including contracted `בַ`, `כַ`, or `לַ`, may be chazak.

| Hebrew | Output |
|---|---|
| מִקְדָּשׁ | mikdash |
| הַמֶּלֶךְ | hammelekh |
| וַיֹּאמֶר | vayyomer |
| וָדָּֽעַת | vada·at |

## 7. Kamatz

Kamatz is normally transliterated as `a`.

Kamatz katan is transliterated as `o`.

Kamatz is treated as kamatz katan when it appears under an unstressed closed syllable.

A closed syllable has two letters, and the second letter has a consonant sound.

A one-letter syllable can never be closed.

Plain final heh does not close a syllable for kamatz katan detection. Final heh with mappiq is consonantal and may close a syllable.

A kamatz before a silent alef is always treated as kamatz gadol because the alef does not close the syllable. This applies both inside a word, as in `לִקְרָאתוֹ` -> `likra·to` and `צַוָּארוֹ` -> `tzava·ro`, and in final or Aramaic patterns such as `עָלְ֒מַיָּא` -> `alemaya` and `לְעֵֽלָּא` -> `le·ela`.

The `כָּל` family is always treated as kamatz katan when standalone or with the listed attached prefixes, whether the khaf has dagesh or not: `כָּל`, `כָּל`, `כָל`, `ככָּל`, `ככָל`, `כְּכָל`, `לכָּל`, `לכָל`, `הכָּל`, `הכָל`, `מִכָּל`, `מִכָל`, `בכָּל`, `בכָל`, `בְּכָּל`, `בְּכָל`, `וּבְכָּל`, `וּבְכָל`, `שכָּל`, `שכָל`, `וְכָּל`, `וְכָל`. Thus `כְּכָל` -> `kekhol` in Modern Sephardi.

Kamatz katan has three governing cases, all requiring that the kamatz syllable be unaccented:

1. The syllable is closed and unaccented.
2. The following letter has dagesh chazak; the doubled consonant closes the preceding unaccented syllable and makes its kamatz katan, as in the `o` of `ozi`. Dagesh kal does not double the consonant and does not close the preceding syllable.
3. The following letter has chataf kamatz; the chataf kamatz behaves like sh'va for determining closure.

An ordinary kamatz (`ָ`, U+05B8) with meteg or a trope mark on the same letter is always accented and therefore always kamatz gadol. This invariant is evaluated before every inferred kamatz-katan test, including closure, a following dagesh chazak, and a following chataf kamatz. For example, unmarked `קָדְשִׁי` -> `kodshi`, while `קָֽדְשִׁי` and `קָ֣דְשִׁי` -> `kadeshi` because the marked kamatz is gadol and the following sh'va is na.

Unicode's explicit qamatz-katan character (`ׇ`, U+05C7) remains qamatz katan even when the source also places meteg or trope on the letter. It is already an explicit vowel classification rather than an ambiguous ordinary kamatz. Thus `כׇֽל` remains `kol` and `אׇֽהֳלֹה` remains `oholoh`.

Some Sefaria Tanakh forms omit an expected meteg before a vocal sh'va. For reviewed forms in the ruleset's missing-meteg list, the application treats the kamatz as gadol and the following sh'va as vocal, as though the meteg were present. Examples include `שָׁרְצוּ` -> `sharetzu`, `נָפְלוּ` -> `nafelu`, and `יָצְאוּ` -> `yatze·u`. This is a curated morphological override, not a general rule for every kamatz followed by sh'va; `חָכְמָה` -> `ḥokhmah` remains kamatz katan with a silent sh'va.

Meteg and trope marks can indicate stress. They are used for analysis but do not appear in output.

Examples:

| Hebrew | Output | Note |
|---|---|---|
| כָּל | kol | kamatz katan |
| חָכְמָה | ḥokhmah | kamatz katan |
| חָנֵּֽנוּ | ḥonenu | following dagesh closes the syllable |
| צׇהֳרָֽיִם | tzohorayim | chataf kamatz behaves like sh'va |
| קָדְשִׁי | kodshi | kamatz katan |
| קָדְשְׁ֒ךָ | kodshekha | closed unstressed first syllable |
| מִלְּ֒פָנֶֽיךָ | milefanekha | single-letter syllable is not closed |
| וּבָרוּךְ | uvarukh | following shuruk gives resh its own vowel |
| הֹוֶה | hoveh | vav with its own vowel is consonantal |
| סֶּֽלָה | selah | plain final heh does not close syllable |
| הִ֖וא | hi | feminine pronoun exception |
| הֽוּא | hu | masculine pronoun exception |
| הַהִ֖וא | hahi | prefixed feminine pronoun exception |
| הָיְתָ֥ה | hayetah | exception |
| שְׁתַּיִם | shtayim | exception |
| שְׁתֵּי | shtei | exception |
| מִשְׁנֶ֔ה | mishneh | initial mem is root letter, not prefix |
| מִשְׂגָּב | misgav | `מִ` is part of the word pattern; following sh'va is silent |
| מִזְבֵּחַ / מִזְבְּחוֹת | mizbeaḥ / mizbeḥot | lexical `מִ` word pattern; following sh'va is silent |
| מִנְחָה / מִנְחוֹת | minḥah / minḥot | lexical `מִ` word pattern; following sh'va is silent |
| מִצְרַיִם | mitzrayim | lexical `מִ` word pattern; following sh'va is silent |
| מִקְנֶה / מִקְנִים | mikneh / miknim | lexical `מִ` word pattern; following sh'va is silent |
| מִשְׁנָה / מִשְׁנָיוֹת | mishnah / mishnayot | lexical `מִ` word pattern; following sh'va is silent |
| מִשְׁתֶּה / מִשְׁתִּים | mishteh / mishtim | lexical `מִ` word pattern; following sh'va is silent |
| מִשְׁגֶּה / מִשְׁגִּים | mishgeh / mishgim | lexical `מִ` word pattern; following sh'va is silent |
| מִשְׂגַּבִּים | misgabim | lexical `מִ` word pattern; following sh'va is silent |
| מִצְוָה / מִצְוֹת | mitzvah / mitzvot | lexical `מִ` word pattern; following sh'va is silent |
| בְּעָלְמָא | be·alma | Kaddish/Aramaic exception; kamatz gadol |
| וּלְעָלְמֵי | ul·almei | Kaddish/Aramaic exception; kamatz gadol |
| עָלְמַיָּא | almaya | Kaddish/Aramaic exception; kamatz gadol |
| עָלְ֒מַיָּא | alemaya | Aramaic exception with vocal sh'va indicated by trope |
| דְכָל | dekhol | Kaddish/Aramaic exception; kamatz katan |
| עָרְבָה / וְעָרְבָה | arvah / ve·arvah | morphology requires kamatz gadol despite closed-syllable surface pattern |
| הַלְ֒לוּיָהּ | haleluyaḣ | final stressed yahh stays kamatz gadol |
| יָבֹֽאוּ | yavo·u | silent alef between vowel sounds |
| רְאוּבֵ֣ן | re·uven | silent alef between vocal sh'va and shuruk |
| בִּמְאֹ֣ד | bim·od | silent alef starts a vowel syllable after closed consonant |
| יִשָּׂשכָר | Yissakhar | exception: second shin/sin included with first |
| דָּבָר | davar | kamatz gadol |
| שָׁלוֹם | shalom | kamatz gadol |

## 8. Sh'va

In Modern Sephardi, vocal sh'va is represented by `e` after the consonant.

In Lev Shalem and Mishkan Tefilah, vocal sh'va is represented by an apostrophe after the consonant.

Silent sh'va produces no output.

Examples:

| Hebrew | Output |
|---|---|
| בְּרֵאשִׁית | bereshit |
| וְדָוִד | vedavid |
| לְשָׁלוֹם | leshalom |
| וַיְהִי | vayehi |
| וּנְתָנָ֞ם | un·tanam |

The five governing sh'va-na rules are:

1. **First letter:** Sh'va under the first letter of a word is always na.
2. **Consecutive sh'vas:** When two sh'vas occur consecutively in the middle of a word, the first is silent and the second is na.
3. **After a long vowel:** Sh'va immediately following a tenuah gedolah is na.
4. **Dagesh:** Sh'va under a letter containing dagesh is always na.
5. **Identical letters (ha-domot):** When two identical letters are adjacent and the first carries sh'va, that sh'va is na, as in *hininei*.

Representative outputs are `תְּנוּ` -> `tenu` (first letter), `יִשְׁמְרוּ` -> `yishmeru` (second consecutive sh'va), `תּוֹלְדֹת` -> `toledot` (after a long vowel), `יִתְּנוּ` -> `yitenu` (dagesh), and `הִנְנִי` -> `hineni` (identical letters).

A sh'va under the final letter of a word is silent. This boundary condition is evaluated before the five rules; for example, the final khaf in `בָּרוּךְ` remains `kh`, not `khe`, even though it follows shuruk.

These five tests are decisive and run before suffix or source-repair heuristics. A heuristic may identify additional vocal sh'vas in a documented spelling pattern, but it may never turn a sh'va that meets one of these rules into sh'va nach.

Additional documented spelling patterns include sh'va under the first letter after the pointed prefixes `כַּ`, `מִ`, `שֶׁ`, `בַּ`, `לַ`, and `הַ`; the final `תְךָ`, `תְכֶם`, `תְכֶן`, `בְךָ`, `בְכֶם`, and `בְכֶן` patterns; and yod in the initial `וַיְ` pattern. A meteg or trope mark directly on the sh'va-bearing letter is also treated as explicit evidence that the sh'va is vocal.

Exception to rule 3: in the object marker forms `אֶתְךָ`, `אֶתְכֶם`, and `אֶתְכֶן`, the tav sh'va is silent because the tav closes `אֶת`.

Rules 1 and 4 take precedence over the verb-suffix heuristic. Thus the sh'va is vocal in `תְּנוּ` -> `tenu`, `יִתְּנוּ` -> `yitenu`, and `וַיִּתְּנוּ` -> `vayitenu` in Modern Sephardi; apostrophe styles render the same sh'va as `t'nu`, `yit'nu`, and `vayit'nu`.

A plain sh'va that closes the stem before common verb suffixes is silent only when none of the five governing sh'va-na rules applies. This includes appropriate forms before `נוּ` and before the tav suffixes `תִּי`, `תָּ`, `תְּ`, `תֶּם`, and `תֶּן`. When Sefaria supplies a long kamatz before that sh'va, rule 3 remains decisive, as in `יָדָֽעְתִּי` -> `yadaeti`, `אֲנָֽחְנוּ` -> `anaḥenu`, `פָשָֽׁעְנוּ` -> `fashaenu`, and `גָּאָֽלְתָּ` -> `ga·aleta`. If a guttural has a sounded reduced vowel, the text will usually show a chataf vowel instead.

Meteg is useful for identifying a sh'va following a stressed kamatz. Trope marks, when present, can also indicate stress.

After conjunctive shuruk (`וּ`), the following sh'va is treated as sh'va nach unless another rule makes it vocal. If the conjunctive shuruk has meteg or trope, the following sh'va is vocal, as in `וּֽזְהַ֛ב` -> `uzehav` in Modern Sephardi.

If the letter after initial conjunctive shuruk is an attached prefix letter (`ב`, `כ`, `ל`, or `מ`) with sh'va before another consonant, that sh'va remains silent even when the shuruk has meteg, as in `וּֽבְשׇׁכְבְּךָ֖` -> `uv·shokhbekha`.

In Lev Shalem, initial conjunctive shuruk is output as `u-`.

Lev Shalem's `mi-` separator is used only for a genuine attached `מִ־` prefix. It is not inserted in lexical words whose following sh'va is silent, such as `מִלְחָמָה` -> `milḥamah` and `מִלְחָמוֹת` -> `milḥamot`.

The long vowels that make a following sh'va vocal are kamatz gadol, tzeire, shuruk, holam malei, and hiriq gadol. Conjunctive shuruk is excluded from this long-vowel sh'va rule. Examples include `תּוֹלְדֹת` -> `toledot`, `כְּכוֹכְבֵי` -> `kekhokhevei`, and `עוֹדְךָ` -> `odekha`. In `וּלְעֽוֹלְמֵי`, the second lamed follows `וֹ`, so the lamed sh'va is likewise vocal: `ul·olemei`.

## 9. Stress Marks, Meteg, and Trope

Meteg and trope marks do not appear in output.

They should be retained during analysis because they can identify stressed syllables.

All Hebrew words are treated as having either ultimate or penultimate primary stress.

Stress detection rules:

1. If a word has no meteg or trope marking a stress point, assume ultimate stress.
2. If meteg or trope appears on the second-to-last syllable, assign penultimate primary stress.
3. If meteg or trope appears on the final syllable, assign ultimate primary stress.
4. If meteg or trope appears on any other syllable, treat that syllable as having secondary stress.
5. A secondary stress mark does not replace the word's primary ultimate or penultimate stress.
6. If only secondary stress is explicitly marked, assume ultimate primary stress unless a penultimate stress marker is also present.
7. If a stress mark appears on a sheva-only letter, attach the mark to the following syllable for analysis. If that forwarded mark lands on the penultimate syllable, it does not by itself override default ultimate stress.
8. If a word has repeated Pashta marks, use the visually rightmost Pashta as the stress-bearing one.

Stress affects:

- kamatz gadol vs kamatz katan
- sh'va na vs sh'va nach

If trope marks are present, they should be treated as stress indicators in the same general role as meteg.

The masora circle (`֯`) is ignored for stress detection and output.

Some common liturgical forms lack meteg or trope in siddur sources but have non-default stress. These may use stress-only overrides for the optional stress-mark display without changing the base transliteration. Examples include `אֱלֹהֵינוּ` -> `Elohéinu` and `אֱלֹהֶיךָ` -> `Elohékha`.

When optional stress marks are enabled, ordinary final stress is not marked. Single-syllable words such as `אֶת`, `אֵל`, and `כָּל` are left unmarked. Non-final stress is marked, and a second accent may also be shown for a true secondary accent, as in `וְאָ֣הַבְתָּ֔` -> `ve·áhavtá`, `תַּֽדְשֵׁ֤א` -> `tádshé`, `עֹֽשֶׂה־פְּרִ֛י` -> `óseh-perí`, and `וַֽיְהִי־אֽוֹר` -> `váyehi-ór`. Internal secondary stress inferred only for analysis is not displayed as an extra stress mark.

## 10. Furtive Patach

A patach under final ח, ע, or הּ is pronounced before the final consonant.

Examples:

| Hebrew | Output |
|---|---|
| רוּחַ | ruaḥ |
| מָשִׁיחַ | mashiaḥ |
| נֹחַ | noaḥ |

## 11. Vav

Vav may act as a consonant or as part of a vowel.

| Hebrew Pattern | Output |
|---|---|
| ו as consonant | v |
| וְ with vocal sh'va | ve |
| וּ shuruk | u |
| וְּ with dagesh and sh'va | ve |
| וֹ holam-vav | o |
| וּוּ double vav | first vav is consonantal v |

Examples:

| Hebrew | Output |
|---|---|
| וּמֹשֶׁה | umoshe |
| וְדָוִד | vedavid |
| שֶׁנִּצְטַוּוּ | shenitztavu |

## 12. Maqaf and Punctuation

In Lev Shalem, initial conjunctive shuruk is `u-`, for example `וּמֹשֶׁה` -> `u-mosheh`.

Maqaf always becomes an English hyphen.

Words connected by maqaf are treated as one stress unit. Stress is assigned across the whole maqaf-connected sequence, while the output still preserves the hyphen.

Punctuation and whitespace should otherwise be preserved where possible.

Periods, commas, colons, semicolons, dashes, and newlines are preserved.

Psik (`׀`) is ignored.

Sof pasuq (`׃`) is output as a colon.

The first letter of the transliterated output is capitalized. The first letter after a newline, period, or colon is also capitalized.

Example:

| Hebrew | Output |
|---|---|
| כָּל־הָאָרֶץ | kol-ha·aretz |
| אֶ֯ל־משֶׁה | el-mosheh |
| אֶ֯ת־כָּל־מִצְוֹתָי | et-kol-mitzvotay |
| וּבְכָל־נַפְשְׁ֒ךָ | uv·khol-nafshekha |
| בְּכׇל־לְבָבְךָ֥ | bekhol-levavekha |

## 13. Sacred Names and Liturgical Capitalization

Default output is lowercase except for sacred names and recognized liturgical phrase forms.

The divine name is transliterated as `Adonai`.

| Hebrew | Output |
|---|---|
| יְיָ | Adonai |
| לַייָ | Ladonai |
| יהוה | Adonai |
| לה׳ / לה' | Ladonai |
| ה׳ | Adonai |
| ה' | Adonai |

Forms of divine names should be capitalized when recognized exactly.

Examples include:

| Hebrew/Form | Output |
|---|---|
| אֲדֹנָי | Adonai |
| אֱלֹהִים | Elohim |
| אֱלֹהֵי | Elohei |
| אֱלֹהָי | Elohai |
| אֱלֹהַי | Elohai |
| אֱלֹהֵינוּ | Eloheinu |
| אֱלֹהֶיךָ | Elohekha |
| אֱלֹהֵיכֶם | Eloheikhem |
| אֱלֹהֵיכֶן | Eloheikhen |
| אֵל | El |
| אֱלוֹהַּ | Eloah |
| אֱלוֹהַי | Elohai |
| אֱלֹהָיו | Elohav |
| אֱלֹהֶיהָ | Eloheha |
| אֱלֹהֵיהֶם | Eloheihem |
| אֱלֹהֵיהֶן | Eloheihen |
| אֲדֹנֵינוּ | Adoneinu |

Recognized phrase forms may also receive capitalization.

Example:

| Hebrew | Output |
|---|---|
| בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ | Barukh Atah Adonai Eloheinu |

## 14. Exception Dictionary Policy

The transliterator should rely on rules as much as possible.

The exception dictionary should be minimal and reserved for cases that are impossible or impractical to resolve from the written form.

Appropriate uses:

- sacred names
- phrase capitalization such as `Atah`; `barukh` follows ordinary sentence capitalization.
- words with ambiguous stress when no meteg or trope is present
- cases where kamatz katan or sh'va cannot be determined from niqqud and rule-based syllable analysis
- safe short unvocalized words whose pronunciation is unambiguous enough for this project
- rare irregular forms

The exception dictionary should not replace general rules for consonants, vowels, dagesh, vowel letters, sh'va, kamatz, maqaf, or furtive patach.

Current safe short unvocalized exceptions:

| Hebrew | Modern Sephardi Output |
|---|---|
| כּל | kol |
| כל | khol |
| לא | lo |
| לו | lo |
| וְלא | velo |
| ולו | velo |
| וכל | vekhol |
| וכּל | vekol |
| טוב | tov |
| עושה | oseh |
| בו | bo |
| או | o |
| אדני | Adonai |
| אלהינו | Eloheinu |
| אלהי | Elohei |
| גדל | godel |
| הכל | hakol |
| יעקב | yaakov |

Other targeted assumptions:

| Hebrew | Modern Sephardi Output |
|---|---|
| יִשרָאֵל | yisrael |
| בְּיִשרָאֵל | beyisrael |
| גדֶל | godel |
| שפָתַי | sefatay |
| אֲבותֵינוּ | avoteinu |
| אָבות | avot |
| יַעֲקב | yaakov |
| הַכּל | hakol |

## 15. Output Separators

When a silent alef or ayin creates two adjacent vowel sounds in the transliterated output, insert a separator for clarity.

When a syllable begins with a silent alef or ayin carrying a vowel, and the previous consonant belongs to the previous syllable, insert a separator before the vowel-starting syllable.

When a silent alef is followed by a sounded consonant, insert a separator only when the alef follows kamatz gadol. This keeps `רָֽאשֵׁיכֶ֗ם` -> `ra·sheikhem`, but leaves `מְלַאכְתּ֖וֹ` -> `melakhto` and `בְּרֵאשִׁית` -> `bereshit`.

Vowel-vowel separators are style-specific:

| Style | Separator |
|---|---|
| Modern Sephardi | `·` |
| Lev Shalem | `·` |
| Mishkan Tefilah | `-` |

When an initial shuruk word begins with `וּ` followed by a consonant with silent sh'va, and the next consonant begins the next syllable, insert a consonant-boundary separator before that next consonant.

Consonant-boundary separators are style-specific:

| Style | Separator |
|---|---|
| Modern Sephardi | `·` |
| Lev Shalem | apostrophe |
| Mishkan Tefilah | `-` |

Examples:

| Hebrew | Output |
|---|---|
| הָעָם | ha·am |
| וָעֶד | va·ed |
| בִּמְאֹ֣ד | bim·od |
| וַאֲנַֽחְנוּ | va·anaḥnu |
| וּמְקַיֵּם | um·kayem |
| וּנְשַׁבֵּחֲךָ | un·shabeḥakha |

Style-specific examples:

| Hebrew | Modern Sephardi | Lev Shalem | Mishkan Tefilah |
|---|---|---|---|
| בְּרֵאשִׁית | bereshit | b'reshit | b'reishit |
| וּמֹשֶׁה | umosheh | u-mosheh | umosheh |
| וּמְקַיֵּם | um·kayem | u-m'kayem | um-kayeim |
| וּנְשַׁבֵּחֲךָ | un·shabeḥakha | u-n'shabeḥakha | un-shabeḥacha |
| וַיְהִי | vayehi | vay'hi | vay'hi |
| הָיְתָה | hayetah | hay'tah | hay'tah |
| בְּעָלְמָא | be·alma | b'alma | b'alma |
| וּלְעָלְמֵי | ul·almei | u-l·almei | ul-almei |
| דְכָל | dekhol | d'khol | d'chol |
| לְבָבְךָ | levavekha | l'vav'kha | l'vav'cha |
| הַמֶּלֶךְ | hamelekh | ha-melekh | hamelekh |
| שֶׁבְרָכָה | sheverakhah | she-v'rakhah | shev'rachah |
| בָּאָרֶץ | ba·aretz | ba-aretz | ba-aretz |
| הָעָם | ha·am | ha·am | ha-am |
| הָאֵל | ha·el | ha·el | ha-el |
| חָכְמָה | ḥokhmah | ḥokhmah | chochmah |
| חֵי | ḥei | ḥei | chei |

## 16. Initial Test Corpus

| Hebrew | Expected Output | Rule Area |
|---|---|---|
| שָׁלוֹם | shalom | basic vowels |
| בְּרֵאשִׁית | bereshit | vocal sh'va; tzere remains e before silent alef |
| וְדָוִד | vedavid | vav with vocal sh'va |
| וּמֹשֶׁה | umosheh | shuruk and final heh |
| וַיְהִי | vayehi | sh'va after initial prefix |
| וּנְתָנָ֞ם | un·tanam | sh'va after conjunctive shuruk is nach; consonant boundary marked |
| כָּל | kol | kamatz katan |
| חָכְמָה | ḥokhmah | chet and kamatz katan |
| חָנֵּֽנוּ | ḥonenu | following dagesh closes the syllable |
| צׇהֳרָֽיִם | tzohorayim | chataf kamatz behaves like sh'va |
| קָדְשִׁי | kodshi | kamatz katan |
| קָדְשְׁ֒ךָ | kodshekha | kamatz katan in closed unstressed syllable |
| מִלְּ֒פָנֶֽיךָ | milefanekha | kamatz gadol in open syllable |
| בִּישׁוּעָתְ֒ךָ | bishu·atekha | marked sh'va opens preceding kamatz syllable |
| דָּבָר | davar | kamatz gadol |
| וּבָרוּךְ | uvarukh | open syllable before shuruk |
| הֹוֶה | hoveh | vav with its own vowel is consonantal |
| סֶּֽלָה | selah | plain final heh does not close syllable |
| הִ֖וא | hi | feminine pronoun exception |
| הֽוּא | hu | masculine pronoun exception |
| הַהִ֖וא | hahi | prefixed feminine pronoun exception |
| הָיְתָ֥ה | hayetah | exception |
| שְׁתַּיִם | shtayim | exception |
| שְׁתֵּי | shtei | exception |
| מִשְׁנֶ֔ה | mishneh | initial mem is root letter, not prefix |
| הַלְ֒לוּיָהּ | haleluyaḣ | final stressed yahh stays kamatz gadol |
| יָבֹֽאוּ | yavo·u | middle dot across silent alef |
| רָֽאשֵׁיכֶ֗ם | ra·sheikhem | silent alef before consonant boundary |
| מְלַאכְתּ֖וֹ | melakhto | no separator after silent alef following patach |
| רְאוּבֵ֣ן | re·uven | middle dot across silent alef |
| בִּמְאֹ֣ד | bim·od | middle dot before vowel-starting alef syllable |
| יִשָּׂשכָר | Yissakhar | exception: second shin/sin included with first |
| מִקְדָּשׁ | mikdash | dagesh chazak not doubled |
| מִצִּיּוֹן | mitziyon | yod-holam-vav |
| בַּיּוֹם | bayom | yod has holam-vav, not patach-yod |
| רוּחַ | ruaḥ | furtive patach |
| מָשִׁיחַ | mashiaḥ | furtive patach |
| נֹחַ | noaḥ | furtive patach |
| תּוֹרָה | torah | final heh |
| לָהּ | laḣ | final mappiq heh |
| סוֹמֵךְ | Somekh | final sh'va is silent |
| עֲלֵיכֶם | aleikhem | silent ayin, tzere-yod |
| כָּל־הָאָרֶץ | kol-ha·aretz | maqaf |
| אֶ֯ל־משֶׁה | el-mosheh | shin dot doubles as holam |
| אֶ֯ת־כָּל־מִצְוֹתָי | et-kol-mitzvotay | holam-vav after sh'va is consonantal |
| וּבְכָל־נַפְשְׁ֒ךָ | uv·khol-nafshekha | maqaf joins stress unit; consonant boundary marked |
| בְּכׇל־לְבָבְךָ֥ | bekhol-levavekha | final בְךָ suffix sh'va is vocal |
| לְבָבְכֶם | levavekhem | final בְכֶם suffix sh'va is vocal |
| לְבָבְכֶן | levavekhen | final בְכֶן suffix sh'va is vocal |
| בְּכָל֯־לְ֯בָבְ֒ךָ וּבְכָל־נַפְשְׁ֒ךָ וּבְכָל־מְאֹדֶֽךָ: | bekhol-levavekha uv·khol-nafshekha uv·khol-me·odekha: | masora circle ignored; consonant boundary marked |
| בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ | Barukh Atah Adonai Eloheinu | liturgical capitalization |
| שֶׁיְהֹוָה | she·Adonai | prefixed divine name |
| לָיְלָה | lailah | exception |
| לַֽיהֹוָ֔ה | Ladonai | exception |
| לַיהוָֹה | Ladonai | exception; alternate pointing/mark order |
| בַּֽיהֹוָ֔ה | Badonai | exception |
| כַּיהֹוָ֖ה | Kadonai | exception |
| כֵּאלֹהֵֽינוּ | Keloheinu | exception |
| כַּאדונֵינוּ | Kadoneinu | exception |
| פָּנָיו | panav | final yod-vav |
| וְהָיוּ | vehayu | final shuruk is not yod-vav to av |
| הָאֵֽלֶּה | ha·eleh | final silent heh after segol |
| מְצַוְּ֒ךָ | metzavekha | vav with dagesh and sh'va is consonantal |
| לְשָׁלוֹם | leshalom | vocal sh'va as e |
| הָעָם | ha·am | double vowel clarity |
| וָעֶד | va·ed | double vowel clarity |
| וַאֲנַֽחְנוּ | va·anaḥnu | double vowel clarity |

## 16. Open Implementation Notes

These are not open transliteration decisions, but implementation details to settle while coding:

- Exact Unicode normalization strategy.
- Whether trope marks are fully parsed or simply recognized as stress indicators.
- How much syllable parsing is needed before falling back to exceptions.
- How exception entries are stored and matched.
- Whether the UI should expose alternate transliterations in the future.
