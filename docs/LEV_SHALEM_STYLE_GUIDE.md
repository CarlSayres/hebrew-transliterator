# Lev Shalem Transliteration Style Guide

Status: approved and implemented as the governing guide for the Lev Shalem profile.

## 1. Evidence Base

This guide was derived from the transliteration printed in two supplied excerpts from *Siddur Lev Shalem for Shabbat and Festivals* (Rabbinical Assembly, 2016):

- Shabbat morning, including Rosh Hodesh, Musaf, and Hallel
- Kabbalat Shabbat and Maariv

The review covered 183 PDF pages. The distinct red transliteration font yielded 1,026 lines, 6,361 word-like tokens, and 2,521 distinct forms. Full extracted text remains in ignored local reports; this public guide contains only conventions and short examples.

The printed source is authoritative for the Lev Shalem profile. When isolated examples conflict, the web application should apply the consistent rules in this guide rather than reproduce a copy-editing inconsistency.

## 2. Canonical Web Characters

The printed siddur uses typographic characters that have equivalent plain-web forms. The application should normalize them consistently:

| Function | Printed form | Canonical application form |
|---|---|---|
| Sh'va marker | `’` | `'` |
| Attached-morpheme boundary | hyphen | `-` |
| Hiatus or clarity boundary | centered dot variants | `·` (U+00B7) |
| Chet | precomposed or overlaid dotted h | `ḥ` (`h` + combining dot below) |

An apostrophe, hyphen, and centered dot are not interchangeable.

## 3. Consonants

| Hebrew | Lev Shalem output |
|---|---|
| א | normally silent |
| בּ / ב | `b` / `v` |
| ג | `g` |
| ד | `d` |
| ה | `h` when sounded |
| ו | `v` when consonantal |
| ז | `z` |
| ח | `ḥ` |
| ט | `t` |
| י | `y` when consonantal |
| כּ / כ, ך | `k` / `kh` |
| ל | `l` |
| מ / ם | `m` |
| נ / ן | `n` |
| ס | `s` |
| ע | normally silent |
| פּ / פ, ף | `p` / `f` |
| צ / ץ | `tz` |
| ק | `k` |
| ר | `r` |
| שׁ / שׂ | `sh` / `s` |
| ת | `t` |

Final mappiq heh is rendered with ordinary `h`. Furtive patah precedes the final guttural consonant in pronunciation: `רוּחַ` -> `ruaḥ`.

## 4. Vowels and Vowel Letters

| Hebrew vowel | Lev Shalem output |
|---|---|
| Patah and kamatz gadol | `a` |
| Kamatz katan and hataf kamatz | `o` |
| Segol | `e` |
| Tzere | `ei` |
| Tzere-yod | `ei` |
| Hiriq | `i` |
| Holam | `o` |
| Kubutz and shuruk | `u` |
| Hataf patah | `a` |
| Hataf segol | `e` |

Mater letters do not add a second vowel. Adjacent vowel sounds separated by silent alef or ayin receive a centered dot when the boundary would otherwise be unclear: `ya·akov`, `ko·aḥ`, `po·el`, `ba·al`.

When tzere appears on a consonantal yod, the yod retains its consonantal value and the vowel is rendered `e`, as in `kayem`; it does not become the sequence `yei`.

## 5. Sh'va and the Apostrophe

A vocal sh'va is represented by an apostrophe immediately after its consonant. Lev Shalem also uses the apostrophe at certain written sh'va boundaries after a separated prefix, as in `u-m'kayem`; the mark should therefore be read as a reduced-vowel boundary rather than as a complete phonetic analysis. It is not written as `e`:

| Hebrew | Lev Shalem pattern |
|---|---|
| בְּרֵאשִׁית | `b'reishit` |
| שְׁמַע | `sh'ma` |
| קִדְּשָׁנוּ | `kid'shanu` |
| יוֹשְׁבֵי | `yosh'vei` |
| הַלְלוּ | `hal'lu` |
| הַלְלוּהוּ | `hal'luhu` |

A silent sh'va is not represented by an apostrophe merely because it is written in Hebrew. If a silent consonant boundary would be hard to read, use the centered-dot rule in section 7.

## 6. Hyphens and Attached Morphemes

A hyphen marks the boundary after an attached Hebrew morpheme that has a fully written vowel in the transliteration. It is primarily morphological, not a general syllable separator.

Attested patterns include:

| Pattern | Examples from the source |
|---|---|
| Definite article | `ha-olam`, `ha-aretz`, `ha-shabbat`, `ha-n'shamah` |
| Shin prefix | `she-asani`, `she-bara` |
| Bet prefix | `ba-aretz`, `be-emet`, `vi-g'vurotav` |
| Lamed prefix | `la-adon`, `la-shemesh` |
| Mem prefix | `mi-pinu`, `mei-et` |
| Kaf prefix | `ka-katuv` |
| Vav conjunction | `u-mosheh`, `va-ed`, `ve-emet` |

When the prefix itself carries vocal sh'va, the sh'va apostrophe is used instead of inventing a full vowel and hyphen: `b'khol`, `l'olam`, `v'al`, `k'vod`.

For conjunctive vav, follow the Hebrew point rather than assigning one spelling to every conjunction:

| Pointed form | Lev Shalem pattern |
|---|---|
| `וְ־` | `v'` (`V'ahavta`, `v'lo`) |
| `וֶ־` / `וֵ־` | `ve-` (`ve-emet`) |
| `וַ־` / `וָ־` | `va-` (`va-ed`) |
| `וּ־` | `u-` (`u-mosheh`) |

Stacked prefixes retain the appropriate marker at each boundary: `u-l'almei`, `u-v'khol`, `v'ha-g'vurah`.

The renderer must determine whether an initial syllable is actually an attached morpheme. The opening heh of `הַלְלוּ` belongs to the verb; therefore Lev Shalem prints `Hal'lu`, not `Ha-l'lu`. Psalm 150 likewise has `hal'luhu` and `hal'luyah`.

## 7. Centered Dot

The centered dot is a clarity boundary. It is used in two principal situations.

### 7.1 Vowel hiatus

Use it between adjacent pronounced vowels separated by silent alef or ayin:

- `ya·aseh`
- `ra·ah`
- `moshi·einu`
- `Tz'va·ot`

### 7.2 Ambiguous consonant joins

Use it where adjoining roman consonants could be read as the wrong digraph or obscure a silent syllable boundary:

- `v'yit·hadar`
- `v'yit·halal`
- `bit·ḥu`
- `esh·taḥaveh`
- `y'varekh·kha`

The source PDFs contain both `·` and `∙`, apparently because of font or production differences. The application should normalize both to `·`.

## 8. Hebrew Maqaf

Do not mechanically convert Hebrew maqaf into a roman hyphen in the Lev Shalem profile. The printed transliteration normally uses an ordinary space between independent words even when the Hebrew joins them with maqaf. Psalm 150 includes:

- `Hal'lu El`, not `Hal'lu-El`
- `b'tziltz'lei shama`, not `b'tziltz'lei-shama`

Roman hyphens should therefore be produced by the attached-morpheme rule, not by copying Hebrew punctuation. Maqaf-connected words may still be treated as one stress unit internally.

The fused lexical expression `הַלְלוּ־יָהּ` is the principal exception: it is rendered `Hal'luyah`, with neither a space nor a copied maqaf. A separately written `יָהּ`, as in `תְּהַלֵּל יָהּ`, remains the separate word `yah`.

## 9. Dagesh and Doubled Letters

Lev Shalem does not mechanically double every dagesh ḥazak. Forms such as `kid'shanu` and `raba` remain single in the printed transliteration.

Some established lexical or conventional spellings contain doubled letters, including `Shabbat`, `sukkat`, and `Kippur`. These should be handled as established spellings or reviewed lexical forms, not as evidence for a universal doubling rule.

The application's optional “double dagesh ḥazak” setting is an additional user preference, not part of the baseline Lev Shalem style.

## 10. Divine Names and Capitalization

- The tetragrammaton is rendered `Adonai`.
- Standalone divine names such as `El` and `Elohim` are capitalized.
- `yah` is separate when the Hebrew presents it as a separate word, as in `t'hallel yah`.
- The lexical form `hal'luyah` remains one transliterated word.
- The source generally uses sentence capitalization rather than title-casing every Hebrew proper noun.
- Optional acute stress marks are not part of the printed Lev Shalem style.

## 11. Punctuation and Spacing

The siddur uses editorial commas, periods, brackets, and line divisions that are not always recoverable from pointed Hebrew alone. The application should:

1. Preserve punctuation and line breaks supplied by the input.
2. Map sof pasuk to the application's normal terminal punctuation policy.
3. Apply the Lev Shalem maqaf rule from section 8.
4. Avoid manufacturing editorial commas from trope marks.

## 12. Source Variants and Canonical Choices

The two excerpts are not perfectly uniform. Examples include:

- `Hal'luyah` alongside occasional `Halleluyah`
- `Va-anaḥnu` alongside `Va·anaḥnu`
- `ba-agala` alongside `ba·agala`
- two visually similar centered-dot code points

Do not create lexical exceptions merely to reproduce each isolated inconsistency. Exceptions require a linguistic, morphological, or clearly recurring house-style reason.

For deterministic application output, use the semantic rules above:

- canonical `Hal'luyah`
- a hyphen after a genuine full-vowel prefix: `Va-anaḥnu`, `ba-agala`
- a centered dot for hiatus or a clarity boundary
- one canonical centered-dot character, `·`

## 13. Implementation Requirements

The Lev Shalem profile implements the following source-based requirements:

1. Restore `Hal'lu`, `Hal'luhu`, and `Hal'luyah`; do not treat their opening heh as `ha-`.
2. Use `·`, not apostrophe, for selected consonant boundaries.
3. Render Lev Shalem maqaf between independent words as a space rather than a hyphen.
4. Generalize full-vowel prefix formatting beyond the current hard-coded subset, while retaining lexical safeguards.
5. Correct `u-l·almei` to the attested `u-l'almei`.
6. Prefer `ha-am`, `ha-El`, `va-ed`, and similar morphological divisions over hiatus dots.
7. Render conjunctive `וְ־` as `v'`, reserving `ve-` for a full `e` vowel supplied by the Hebrew.
8. Render tzere as `ei`, including forms such as `b'reishit`, `teika`, `ein`, and `seivah`.
9. Build source-based golden tests from short representative lines rather than isolated invented spellings.

These changes must remain confined to the Lev Shalem profile. Modern Sephardi and Mishkan Tefilah retain their own separator policies.

## 14. Minimum Golden Corpus

The implementation should include exact Lev Shalem regressions for at least:

- Psalm 150 (`Hal'lu`, `hal'luhu`, `hal'luyah`, `vi-g'vurotav`)
- the Sh'ma and its blessings (`Sh'ma`, stacked prefixes, `va-ed`)
- Kaddish (`u-l'almei`, Aramaic sh'va forms, centered-dot boundaries)
- Psalm 29 (`ba-ko·aḥ`, `be-hadar`)
- Ashrei (`yosh'vei`, `malkhut'kha`, hiatus forms)
- Hallel (`mei-atah`, `mi-lifnei`, `Potei·aḥ`)

Each golden test should retain its PDF page reference in test comments or private audit metadata so a future reviewer can verify the printed source.
