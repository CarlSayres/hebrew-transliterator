(function () {
  const HEBREW_LETTER_RE = /[\u05d0-\u05ea]/;
  const MAQAF = "\u05be";
  const PSIK = "\u05c0";
  const SOF_PASUQ = "\u05c3";
  const OUTPUT_VOWEL_RE = /[aeiou]$/i;
  const INPUT_VOWEL_RE = /^[aeiou]/i;

  const MARKS = {
    SHEVA: "\u05b0",
    HATAF_SEGOL: "\u05b1",
    HATAF_PATAH: "\u05b2",
    HATAF_QAMATS: "\u05b3",
    HIRIQ: "\u05b4",
    TSERE: "\u05b5",
    SEGOL: "\u05b6",
    PATAH: "\u05b7",
    QAMATS: "\u05b8",
    HOLAM: "\u05b9",
    HOLAM_HASER: "\u05ba",
    QUBUTS: "\u05bb",
    DAGESH: "\u05bc",
    METEG: "\u05bd",
    SHIN_DOT: "\u05c1",
    SIN_DOT: "\u05c2",
    QAMATS_QATAN: "\u05c7"
  };

  const VOWEL_MARKS = new Set([
    MARKS.HATAF_SEGOL,
    MARKS.HATAF_PATAH,
    MARKS.HATAF_QAMATS,
    MARKS.HIRIQ,
    MARKS.TSERE,
    MARKS.SEGOL,
    MARKS.PATAH,
    MARKS.QAMATS,
    MARKS.HOLAM,
    MARKS.HOLAM_HASER,
    MARKS.QUBUTS,
    MARKS.QAMATS_QATAN
  ]);

  const LONG_VOWELS = new Set([
    MARKS.QAMATS,
    MARKS.TSERE,
    MARKS.HOLAM,
    MARKS.HOLAM_HASER
  ]);

  const TROPE_RANGES = [
    [0x0591, 0x05ae],
    [0x05bd, 0x05bd]
  ];

  const POSITIONAL_TROPE_EDGES = new Map([
    ["\u0592", "end"], // segol
    ["\u0599", "end"], // pashta
    ["\u05a0", "start"], // telisha gedola
    ["\u05a9", "end"], // telisha qetana
    ["\u05ad", "start"], // dehi
    ["\u05ae", "end"] // zinor
  ]);

  const FINAL_GUTTURALS = new Set(["ח", "ע", "ה"]);
  const BEGAD_KEFAT = new Set(["ב", "ג", "ד", "כ", "ך", "פ", "ף", "ת"]);

  function normalize(text) {
    return text.normalize("NFD").replace(/\u034f/g, "");
  }

  function hasHebrew(value) {
    return /[\u05d0-\u05ea]/.test(value);
  }

  function stripMarks(value) {
    return normalize(value).replace(/[\u0591-\u05c7]/g, "");
  }

  function stripTropeAndMeteg(value) {
    return normalize(value).replace(/[\u0591-\u05af\u05bd\u05bf]/g, "");
  }

  function knownUnvocalizedException(word, ruleset) {
    const normalized = normalize(word);
    const cleaned = stripTropeAndMeteg(word);
    const noMarks = stripMarks(word);
    const canUseNiqqudless = normalized === noMarks || noMarks.includes("יהוה") || noMarks === "יי";

    return (
      ruleset.exceptions.exactWords[normalized] ||
      ruleset.exceptions.exactWords[cleaned] ||
      (canUseNiqqudless && ruleset.exceptions.niqqudless[noMarks]) ||
      ruleset.exceptions.phraseCapitalization[normalized] ||
      ruleset.exceptions.phraseCapitalization[cleaned]
    );
  }

  // A quoted hey or two yods can stand for the Name. In an unquoted pair,
  // ordinary vowel points such as the hiriq in חַיִּים belong to a real word.
  const abbreviatedName = /(?<![א-ת\p{M}])(?<![א-ת\p{M}][״"])(?<prefix>(?:(?:ו\p{M}*[בכלמ]|[ובכלמשה])\p{M}*)?)(?:ה\p{M}*[׳'’]|[׳'’]ה\p{M}*|י\p{M}*[״"]י\p{M}*|י[\u0591-\u05b0\u05bd]*י[\u0591-\u05af\u05b8\u05bd]*)(?![א-ת\p{M}]|[״"][א-ת])/gu;

  const elohim = "אֱלֹהִים";
  const spokenDivineNames = new Map(Object.entries({
    "יהוה": "אֲדֹנָי", "ויהוה": "וָדֹנָי", "ביהוה": "בַּדֹנָי",
    "כיהוה": "כַּדֹנָי", "ליהוה": "לַדֹנָי", "מיהוה": "מֵאֲדֹנָי",
    "שיהוה": "שֶׁאֲדֹנָי", "היהוה": "הַאֲדֹנָי", "וביהוה": "וּבַדֹנָי",
    "וכיהוה": "וּכַדֹנָי", "וליהוה": "וְלַדֹנָי", "ומיהוה": "וּמֵאֲדֹנָי"
  }));

  function adjacentWrittenAdonai(tokens, index, step) {
    for (let i = index + step; i >= 0 && i < tokens.length; i += step) {
      const token = tokens[i];
      if (token.type === "maqaf" || token.type === "psik" ||
          (token.type === "other" && /^\s+$/u.test(token.value))) continue;
      if (token.type !== "hebrew") return null;
      const word = stripTropeAndMeteg(token.value);
      // The hiriq in אֲדֹנִי ("my lord") distinguishes it from אֲדֹנָי.
      return word === "אדני" || (/^אד[ו]?ני$/u.test(stripMarks(word)) && /נָי$/u.test(word))
        ? token : null;
    }
    return null;
  }

  function resolveDivineNames(tokens) {
    for (const [index, token] of tokens.entries()) {
      if (token.type !== "hebrew" || !token.value.includes("י") || !token.value.includes("ה")) continue;
      const spelling = stripMarks(token.value);
      const usualReading = spokenDivineNames.get(spelling);
      if (!usualReading) continue;
      token.spokenReading = usualReading;
      const next = adjacentWrittenAdonai(tokens, index, 1);
      if (next) {
        // The site's reading is Adonai Elohim in either written order.
        next.value = next.spokenReading = elohim;
      } else if (spelling === "יהוה") {
        const previous = adjacentWrittenAdonai(tokens, index, -1);
        if (previous) previous.spokenReading = spokenDivineNames.get("יהוה");
        if (previous || /ו\p{M}*\u05b4\p{M}*ה\p{M}*$/u.test(token.value)) {
          token.value = token.spokenReading = elohim;
        }
      }
    }
  }

  function fullName(prefix) {
    return stripMarks(prefix) + "יהוה";
  }

  function splitInput(text) {
    const source = String(text || "");
    const tokens = [];
    let buffer = "";
    let mode = null;
    let bufferStart = 0;
    const names = source.matchAll(abbreviatedName);
    let name = names.next().value;
    const flush = (end) => {
      if (mode === "sofPasuq" && tokens.at(-1)?.type === "hebrew") {
        tokens.at(-1).verseEnd = true;
      }
      if (buffer) tokens.push({ type: mode, value: mode === "other" ? buffer : normalize(buffer),
        sourceStart: bufferStart, sourceEnd: end });
      buffer = "";
    };

    for (let index = 0; index < source.length;) {
      if (name && name.index === index) {
        flush(index);
        const end = index + name[0].length;
        tokens.push({ type: "hebrew", value: fullName(name.groups.prefix), sourceStart: index, sourceEnd: end });
        name = names.next().value;
        index = end;
        mode = null;
        continue;
      }
      const codePoint = source.codePointAt(index);
      const char = String.fromCodePoint(codePoint);
      const charLength = char.length;
      let nextMode = "other";
      if (char === "\u034f" && mode) {
        nextMode = mode;
      } else if (char === MAQAF) {
        nextMode = "maqaf";
      } else if (char === PSIK) {
        nextMode = "psik";
      } else if (char === SOF_PASUQ) {
        nextMode = "sofPasuq";
      } else if (/[\u0591-\u05bd\u05bf-\u05c7\u05d0-\u05ea]/.test(char.normalize("NFD"))) {
        nextMode = "hebrew";
      }

      if (nextMode !== mode) {
        flush(index);
        bufferStart = index;
      }
      mode = nextMode;
      buffer += char;
      index += charLength;
    }

    flush(source.length);
    resolveDivineNames(tokens);
    return tokens;
  }

  function parseClusters(word) {
    const clusters = [];

    for (const char of normalize(word)) {
      if (HEBREW_LETTER_RE.test(char)) {
        clusters.push({
          base: char,
          marks: [],
          vowelName: null,
          vowelOut: "",
          sheva: null,
          primaryStress: false,
          secondaryStress: false,
          displaySecondaryStress: false,
          wordFinal: false
        });
      } else if (clusters.length && /[\u0591-\u05c7]/.test(char)) {
        clusters[clusters.length - 1].marks.push(char);
      }
    }

    if (clusters.length) {
      clusters[clusters.length - 1].wordFinal = true;
    }

    // Biblical ירושלים often writes the yod's hiriq on the lamed alongside
    // its own patah/qamatz. Keep the lamed's accents on the -la- syllable.
    const lamed = clusters[clusters.length - 2];
    if (lamed?.base === "ל" && hasHiriq(lamed) &&
        (hasPatach(lamed) || hasMark(lamed, MARKS.QAMATS)) &&
        clusters.slice(-6).map(cluster => cluster.base).join("") === "ירושלם") {
      lamed.marks = lamed.marks.filter(mark => mark !== MARKS.HIRIQ);
      clusters.splice(clusters.length - 1, 0, { ...lamed, base: "י", marks: [MARKS.HIRIQ] });
    }

    // In Yissakhar the unpointed second shin is silent, also after a prefix.
    if (clusters.at(-3)?.base === "ש" && clusters.at(-4)?.base === "ש" &&
        clusterLookupKey(clusters.slice(-5)) === "יִשָּׂשכָר".normalize("NFD")) {
      clusters.at(-4).issacharSin = true;
      clusters.splice(clusters.length - 3, 1);
    }

    // Daniel 5:6, 5:9: MAM explicitly marks the vav of Aramaic zīwōhī.
    // Some editions print an ordinary holam on it (the word still means
    // "his countenance"). Restrict this ambiguous יוֹ spelling to these forms.
    const danielVav = clusters[clusters.length - 3];
    if (danielVav?.base === "ו" && hasMark(danielVav, MARKS.HOLAM) &&
        /^(?:וְ)?זִיוֹהִי$/u.test(stripTropeAndMeteg(word))) {
      danielVav.marks = danielVav.marks.map(mark => mark === MARKS.HOLAM ? MARKS.HOLAM_HASER : mark);
    }

    // A sin's upper-left dot is sometimes printed once for both the sin dot
    // and a holam haser. Infer the shared vowel on a non-final sin that has
    // no other vowel or sh'va. The principal contrasting spelling is a sin
    // before shuruk, as in עָשׂוּ, where the sin closes the preceding syllable.
    for (let index = 0; index < clusters.length - 1; index += 1) {
      const cluster = clusters[index];
      const next = clusters[index + 1];
      const hasExplicitVowel = cluster.marks.some((mark) => VOWEL_MARKS.has(mark));
      const nextHasExplicitVowel = next.marks.some((mark) => VOWEL_MARKS.has(mark));
      const nextIsShuruk =
        next.base === "ו" &&
        next.marks.includes(MARKS.DAGESH) &&
        !nextHasExplicitVowel &&
        !next.marks.includes(MARKS.SHEVA);
      if (
        cluster.base === "ש" &&
        cluster.marks.includes(MARKS.SIN_DOT) &&
        !hasExplicitVowel &&
        !cluster.marks.includes(MARKS.SHEVA) &&
        !nextIsShuruk &&
        !(next.base === "ו" && hasMark(next, MARKS.HOLAM))
      ) {
        cluster.marks.push(MARKS.HOLAM_HASER);
      }
    }

    return clusters;
  }

  function clusterLookupKey(clusters, startIndex = 0) {
    return clusters.slice(startIndex).map((cluster) => (
      cluster.base + cluster.marks.filter((mark) => {
        const code = mark.codePointAt(0);
        return code > 0x05af && mark !== MARKS.METEG;
      }).join("")
    )).join("").normalize("NFD");
  }

  function markLexicalInitials(clusters, ruleset) {
    const first = clusters[0];
    if (first && "בכלהמ".includes(first.base)) {
      // Initial begadkefat dagesh varies with the preceding word. The corpus
      // lookup excludes spellings attested with both a lexical and a prefix reading.
      const key = clusterLookupKey(clusters)
        .replace(/\u05ba/gu, MARKS.HOLAM)
        .replace(/^([בכ])(\p{M}*)/u, (_, base, marks) => base + marks.replace(MARKS.DAGESH, ""));
      first.lexicalInitial = window.HebrewLexicalInitialConsonants?.has(key) ||
        (first.base === "ה" && ruleset.exceptions.lexicalInitialHey?.[key]);
      // The plural of bayit contracts to bāttim / bāttei. Its long qamatz
      // survives the internal dagesh (also in suffixed forms such as בָּתֵּינוּ).
      if (first.lexicalInitial && first.base === "ב" && hasMark(first, MARKS.QAMATS) &&
          clusters[1]?.base === "ת" && hasMark(clusters[1], MARKS.DAGESH)) {
        first.forceKamatzGadol = true;
      }
    }
    for (let index = 0; index < clusters.length; index++) {
      if (clusters[index].base === "ש") {
        clusters[index].lexicalInitialShe = Boolean(
          ruleset.exceptions.lexicalInitialShe?.[clusterLookupKey(clusters, index)]
        );
      }
    }
  }

  function hasMark(cluster, mark) {
    return cluster.marks.includes(mark);
  }

  function hasAnyMark(cluster, marks) {
    return cluster.marks.some((mark) => marks.has(mark));
  }

  function hasStressMarker(cluster, ignoreDehi = false) {
    return cluster.marks.some((mark) => {
      if (ignoreDehi && mark === "\u05ad") return false;
      const code = mark.codePointAt(0);
      return TROPE_RANGES.some(([start, end]) => code >= start && code <= end);
    });
  }

  function hasMeteg(cluster) {
    return hasMark(cluster, MARKS.METEG);
  }

  function hasDisplayTropeMarker(cluster) {
    return Boolean(cluster?.marks.some((mark) => {
      const code = mark.codePointAt(0);
      return mark !== MARKS.METEG && code >= 0x0591 && code <= 0x05ae;
    }));
  }

  function positionalStressHelperIndexes(clusters) {
    const helpers = new Map();
    for (const [mark, edge] of POSITIONAL_TROPE_EDGES) {
      const indexes = clusters
        .map((cluster, index) => hasMark(cluster, mark) ? index : -1)
        .filter((index) => index >= 0);
      const edgeIndex = edge === "start" ? 0 : clusters.length - 1;
      if (indexes.length > 1 && indexes.includes(edgeIndex)) {
        helpers.set(mark, new Set(indexes.filter((index) => index !== edgeIndex)));
      } else if (mark === "\u05ad" && indexes.length === 1 &&
          (indexes[0] === 0 || clusters[indexes[0] - 1].wordFinal)) {
        // A lone prepositive dehi marks the word, without locating its stressed vowel.
        helpers.set(mark, new Set());
      }
    }
    return helpers;
  }

  function hasEffectiveStressMarker(cluster, index, positionalHelpers, includeMeteg = true) {
    return cluster.marks.some((mark) => {
      if (!includeMeteg && mark === MARKS.METEG) return false;
      const code = mark.codePointAt(0);
      if (!TROPE_RANGES.some(([start, end]) => code >= start && code <= end)) {
        return false;
      }
      const helperIndexes = positionalHelpers.get(mark);
      return !helperIndexes || helperIndexes.has(index);
    });
  }

  function isPositionalStressHelper(cluster, index, positionalHelpers) {
    return cluster.marks.some((mark) => positionalHelpers.get(mark)?.has(index));
  }

  function isDisplayedStress(cluster) {
    return Boolean(
      cluster?.primaryStress ||
        (cluster?.secondaryStress && (hasDisplayTropeMarker(cluster) || cluster.displaySecondaryStress))
    );
  }

  function displayedStressKind(cluster) {
    if (!cluster) {
      return "";
    }
    if (cluster.primaryStress) {
      return "primary";
    }
    if (cluster.secondaryStress && (hasDisplayTropeMarker(cluster) || cluster.displaySecondaryStress)) {
      return "secondary";
    }
    return "";
  }

  function hasShuruk(cluster) {
    return Boolean(
      cluster &&
      cluster.base === "ו" &&
      hasMark(cluster, MARKS.DAGESH) &&
      !getVowelMark(cluster) &&
      !hasMark(cluster, MARKS.SHEVA)
    );
  }

  function hasPatach(cluster) {
    return hasMark(cluster, MARKS.PATAH);
  }

  function hasHiriq(cluster) {
    return hasMark(cluster, MARKS.HIRIQ);
  }

  function hasSegol(cluster) {
    return hasMark(cluster, MARKS.SEGOL);
  }

  function isIgnoredInitialPrefix(cluster, ruleset) {
    if (!cluster) {
      return false;
    }

    return (
      (cluster.base === "כ" && hasMark(cluster, MARKS.DAGESH) && hasPatach(cluster)) ||
      (cluster.base === "מ" && hasHiriq(cluster)) ||
      (
        ruleset?.output?.undageshedBetHiriqPrefix &&
        cluster.base === "ב" &&
        !hasMark(cluster, MARKS.DAGESH) &&
        hasHiriq(cluster)
      ) ||
      (cluster.base === "ש" && hasMark(cluster, MARKS.SHIN_DOT) && hasSegol(cluster)) ||
      (cluster.base === "ב" && hasMark(cluster, MARKS.DAGESH) && hasPatach(cluster)) ||
      (cluster.base === "ל" && hasPatach(cluster)) ||
      (cluster.base === "ה" && hasPatach(cluster))
    );
  }

  function followsVavPatachYodPrefix(clusters, index) {
    const previous = clusters[index - 1];
    return Boolean(
      index === 1 &&
        previous &&
        previous.base === "ו" &&
        hasPatach(previous) &&
        clusters[index].base === "י"
    );
  }

  function isSyllableNucleus(cluster) {
    return Boolean(getVowelMark(cluster) || hasShuruk(cluster));
  }

  function hasWordVocalization(clusters) {
    return clusters.some((cluster) =>
      getVowelMark(cluster) ||
      hasMark(cluster, MARKS.SHEVA) ||
      hasShuruk(cluster)
    );
  }

  function hasOtherWordVocalization(clusters, index) {
    return clusters.some((cluster, clusterIndex) =>
      clusterIndex !== index &&
      (
        getVowelMark(cluster) ||
        hasMark(cluster, MARKS.SHEVA) ||
        hasShuruk(cluster)
      )
    );
  }

  function isUnmarkedVav(cluster) {
    return (
      cluster.base === "ו" &&
      !getVowelMark(cluster) &&
      !hasMark(cluster, MARKS.SHEVA) &&
      !hasMark(cluster, MARKS.DAGESH)
    );
  }

  function isSuperPleneHolamAlefVav(clusters, index) {
    const vav = clusters[index];
    const alef = clusters[index - 1];
    const holamCarrier = clusters[index - 2];
    return Boolean(
      isUnmarkedVav(vav) &&
      alef?.base === "א" &&
      !getVowelMark(alef) &&
      !hasMark(alef, MARKS.SHEVA) &&
      holamCarrier &&
      (hasMark(holamCarrier, MARKS.HOLAM) || hasMark(holamCarrier, MARKS.HOLAM_HASER))
    );
  }

  function shouldRepairMissingHolamMalei(clusters, index) {
    const previous = clusters[index - 1];
    if (
      index === 0 ||
      !isUnmarkedVav(clusters[index]) ||
      !previous ||
      isSuperPleneHolamAlefVav(clusters, index) ||
      !hasOtherWordVocalization(clusters, index) ||
      clusters[index - 1]?.base === "ו" ||
      clusters[index + 1]?.base === "ו" ||
      (previous.base === "י" && index === clusters.length - 1)
    ) {
      return false;
    }

    return !getVowelMark(previous) && !hasShuruk(previous);
  }

  function repairMissingHolamMalei(clusters) {
    clusters.forEach((cluster, index) => {
      if (shouldRepairMissingHolamMalei(clusters, index)) {
        cluster.marks.push(MARKS.HOLAM);
      }
    });
  }

  function isStressShevaNucleus(clusters, index) {
    const cluster = clusters[index];
    if (!hasMark(cluster, MARKS.SHEVA) || getVowelMark(cluster) || !hasStressMarker(cluster)) {
      return false;
    }

    const next = clusters[index + 1];
    return Boolean(next && !isSyllableNucleus(next));
  }

  function getSyllableNuclei(clusters) {
    return clusters
      .map((cluster, index) => ({ cluster, index }))
      .filter(({ cluster, index }) => !isFurtivePatach(clusters, index) &&
        (isSyllableNucleus(cluster) || isStressShevaNucleus(clusters, index)));
  }

  function syllableIndexForCluster(nuclei, clusterIndex, clusters = null) {
    if (
      clusters &&
      clusters[clusterIndex] &&
      !clusters[clusterIndex].wordFinal &&
      !getVowelMark(clusters[clusterIndex]) &&
      !hasMark(clusters[clusterIndex], MARKS.SHEVA) &&
      !hasShuruk(clusters[clusterIndex]) &&
      !(
        clusters[clusterIndex].base === "י" &&
        !hasMark(clusters[clusterIndex], MARKS.DAGESH) &&
        clusters[clusterIndex - 1] &&
        [MARKS.TSERE, MARKS.SEGOL, MARKS.PATAH, MARKS.HIRIQ].includes(getVowelMark(clusters[clusterIndex - 1]))
      )
    ) {
      const nextNucleusIndex = nuclei.findIndex((nucleus) => nucleus.index === clusterIndex + 1);
      if (nextNucleusIndex >= 0) {
        return nextNucleusIndex;
      }
    }

    let syllableIndex = -1;

    for (let i = 0; i < nuclei.length; i += 1) {
      if (nuclei[i].index <= clusterIndex) {
        syllableIndex = i;
      } else {
        break;
      }
    }

    return syllableIndex;
  }

  function stressMarkerSyllableIndex(clusters, nuclei, clusterIndex) {
    const cluster = clusters[clusterIndex];

    if (hasMark(cluster, MARKS.SHEVA) && !getVowelMark(cluster) && !isStressShevaNucleus(clusters, clusterIndex)) {
      const nextNucleus = nuclei.find((nucleus) => nucleus.index > clusterIndex);
      if (nextNucleus) {
        return nuclei.indexOf(nextNucleus);
      }
    }

    return syllableIndexForCluster(nuclei, clusterIndex, clusters);
  }

  function isForwardedShevaStressMarker(clusters, clusterIndex) {
    const cluster = clusters[clusterIndex];
    return Boolean(
      hasMark(cluster, MARKS.SHEVA) &&
        !getVowelMark(cluster) &&
        !isStressShevaNucleus(clusters, clusterIndex)
    );
  }

  function assignStress(clusters, ruleset, verseEnd = false) {
    const nuclei = getSyllableNuclei(clusters);
    if (!nuclei.length) {
      return;
    }

    const lastSyllable = nuclei.length - 1;
    const penultimateSyllable = nuclei.length - 2;
    const markedSyllables = new Set();
    const helperSyllables = new Set();
    const syllableMarks = new Map();
    const positionalHelpers = positionalStressHelperIndexes(clusters);
    const lastWordStart = clusters.findLastIndex((cluster, index) =>
      cluster.wordFinal && index < clusters.length - 1) + 1;
    let silluqSyllable = -1;

    clusters.forEach((cluster, index) => {
      if (!hasEffectiveStressMarker(cluster, index, positionalHelpers)) {
        return;
      }

      const syllableIndex = stressMarkerSyllableIndex(clusters, nuclei, index);
      if (syllableIndex >= 0) {
        // U+05BD serves as both meteg and silluq. Immediately before sof pasuq,
        // the rightmost such mark in the final word is the verse-ending accent.
        if (verseEnd && index >= lastWordStart && hasMeteg(cluster)) silluqSyllable = syllableIndex;
        markedSyllables.add(syllableIndex);
        if (isPositionalStressHelper(cluster, index, positionalHelpers)) {
          helperSyllables.add(syllableIndex);
        }
        const marks = syllableMarks.get(syllableIndex) || { meteg: false, trope: false, directTrope: false, forwardedSheva: false };
        const trope = hasEffectiveStressMarker(cluster, index, positionalHelpers, false);
        const forwarded = isForwardedShevaStressMarker(clusters, index);
        marks.meteg = marks.meteg || hasMeteg(cluster);
        marks.trope = marks.trope || trope;
        marks.directTrope = marks.directTrope || (trope && !forwarded);
        marks.forwardedSheva = marks.forwardedSheva || forwarded;
        syllableMarks.set(syllableIndex, marks);
      }
    });

    let primarySyllable = lastSyllable;
    if (silluqSyllable >= 0) {
      primarySyllable = silluqSyllable;
    } else if (helperSyllables.size === 1) {
      primarySyllable = [...helperSyllables][0];
    } else if (syllableMarks.get(lastSyllable)?.trope) {
      primarySyllable = lastSyllable;
    } else if (
      penultimateSyllable >= 0 &&
      syllableMarks.get(penultimateSyllable)?.directTrope
    ) {
      primarySyllable = penultimateSyllable;
    } else if (!markedSyllables.size || positionalHelpers.get("\u05ad")?.size === 0) {
      const spelling = clusterLookupKey(clusters, lastWordStart);
      if (penultimateSyllable >= 0 && (ruleset?.exceptions?.penultimateStress?.[spelling] ||
          (ruleset?.exceptions?.prayerPenultimateStress?.[spelling] &&
            !clusters.slice(lastWordStart).some(cluster => hasStressMarker(cluster))) ||
          /יְ?רוּשָׁל[ַָ]יִם$/u.test(spelling))) {
        primarySyllable = penultimateSyllable;
      }
    } else if (
      penultimateSyllable >= 0 &&
      markedSyllables.has(penultimateSyllable) &&
      !syllableMarks.get(penultimateSyllable)?.forwardedSheva
    ) {
      primarySyllable = penultimateSyllable;
    } else if (markedSyllables.has(lastSyllable)) {
      primarySyllable = lastSyllable;
    }

    const primaryMarks = syllableMarks.get(primarySyllable) || {};
    const primaryHasExplicitMarker = Boolean(primaryMarks.trope || primaryMarks.meteg);

    clusters.forEach((cluster, index) => {
      const syllableIndex = syllableIndexForCluster(nuclei, index, clusters);
      if (syllableIndex === primarySyllable) {
        cluster.primaryStress = true;
      } else if (markedSyllables.has(syllableIndex)) {
        cluster.secondaryStress = true;
        cluster.displaySecondaryStress = primaryHasExplicitMarker && hasMeteg(cluster);
      }
    });
  }

  function isStressed(cluster) {
    return cluster.primaryStress || cluster.secondaryStress;
  }

  function getVowelMark(cluster) {
    return cluster.marks.find((mark) => VOWEL_MARKS.has(mark)) || null;
  }

  function nextVowelIndex(clusters, index) {
    for (let i = index + 1; i < clusters.length; i += 1) {
      if (getVowelMark(clusters[i]) || hasMark(clusters[i], MARKS.SHEVA)) {
        return i;
      }
    }
    return -1;
  }

  function hasPreviousSoundForDageshChazak(cluster) {
    return Boolean(
      cluster &&
      (
        getVowelMark(cluster) ||
        hasShuruk(cluster) ||
        cluster.sheva === "vocal"
      )
    );
  }

  function isArticlePrefixBeforeDagesh(clusters, index) {
    if (index !== 1) {
      return false;
    }

    const prefix = clusters[0];
    return Boolean(
      (prefix.base === "ה" && hasPatach(prefix)) ||
      (["ב", "כ", "ל"].includes(prefix.base) && hasPatach(prefix))
    );
  }

  function isNonDoublingProcliticBoundary(clusters, index) {
    if (index !== 1 || clusters[0].lexicalInitial || isArticlePrefixBeforeDagesh(clusters, index)) {
      return false;
    }

    const prefix = clusters[0];
    if (prefix?.base === "ש") {
      return !prefix.lexicalInitialShe && hasMark(prefix, MARKS.SHIN_DOT) && hasSegol(prefix);
    }

    return ["ו", "ב", "כ", "ל"].includes(prefix?.base);
  }

  function isDageshChazak(clusters, index) {
    const cluster = clusters[index];
    if (!hasMark(cluster, MARKS.DAGESH)) {
      return false;
    }

    if (
      index === 0 ||
      cluster.wordFinal ||
      cluster.base === "ה" ||
      (hasShuruk(cluster) && clusters[index + 1]?.base !== "ו")
    ) {
      return false;
    }

    if (!BEGAD_KEFAT.has(cluster.base)) {
      return true;
    }

    const previous = clusters[index - 1];
    if (!hasPreviousSoundForDageshChazak(previous)) {
      return false;
    }

    if (isNonDoublingProcliticBoundary(clusters, index)) {
      return false;
    }

    return true;
  }

  function isClosedUnstressedSyllable(clusters, index) {
    const current = clusters[index];
    if (isStressed(current)) {
      return false;
    }

    const next = clusters[index + 1];
    if (!next) {
      return false;
    }

    if (isDageshChazak(clusters, index + 1)) {
      return true;
    }

    if (hasMark(next, MARKS.HATAF_QAMATS)) {
      return true;
    }

    if (next.sheva === "vocal") {
      return false;
    }

    if (hasMark(next, MARKS.SHEVA)) {
      return true;
    }

    if (next.base === "י" && clusters[index + 2]?.base === "ו" && index + 2 === clusters.length - 1) {
      return false;
    }

    if (
      next.wordFinal &&
      !getVowelMark(next) &&
      !hasMark(next, MARKS.SHEVA) &&
      !(next.base === "ה" && !hasMark(next, MARKS.DAGESH))
    ) {
      return true;
    }

    if (
      index + 2 < clusters.length &&
      !getVowelMark(next) &&
      !hasMark(next, MARKS.SHEVA) &&
      !isSyllableNucleus(clusters[index + 2])
    ) {
      return true;
    }

    return false;
  }

  function isKamatzBeforeSilentAlef(clusters, index) {
    const next = clusters[index + 1];
    return Boolean(
      next &&
        next.base === "א" &&
        !getVowelMark(next) &&
        !hasMark(next, MARKS.SHEVA)
    );
  }

  function isKamatzBeforeYodSheva(clusters, index) {
    const next = clusters[index + 1];
    return Boolean(
      next &&
        next.base === "י" &&
        hasMark(next, MARKS.SHEVA)
    );
  }

  function isKolFamilyKamatz(clusters, index) {
    if (
      index !== clusters.length - 2 ||
      clusters[index]?.base !== "כ" ||
      clusters[index + 1]?.base !== "ל"
    ) {
      return false;
    }

    const allowedPrefixLetters = new Set(["ו", "ב", "כ", "ל", "מ", "ה", "ש", "ד"]);
    return clusters.slice(0, index).every((cluster) => allowedPrefixLetters.has(cluster.base));
  }

  function classifyVowels(clusters, ruleset) {
    clusters.forEach((cluster, index) => {
      const vowel = getVowelMark(cluster);
      if (!vowel) {
        return;
      }

      if (vowel === MARKS.PATAH) {
        cluster.vowelName = "patach";
        cluster.vowelOut = ruleset.vowels.patach;
      } else if (vowel === MARKS.QAMATS || vowel === MARKS.QAMATS_QATAN) {
        const next = clusters[index + 1];
        const finalKha = cluster.base === "ך" && index === clusters.length - 1;
        const katan =
          vowel === MARKS.QAMATS_QATAN ||
          (cluster.forceKamatzKatan && !hasStressMarker(cluster)) ||
          (
            !cluster.forceKamatzGadol &&
            (
              isKolFamilyKamatz(clusters, index) ||
              (
                !finalKha &&
                !hasStressMarker(cluster) &&
                !isKamatzBeforeSilentAlef(clusters, index) &&
                !isKamatzBeforeYodSheva(clusters, index) &&
                isClosedUnstressedSyllable(clusters, index)
              )
            )
          );

        cluster.vowelName = katan ? "kamatzKatan" : "kamatzGadol";
        cluster.vowelOut = katan ? ruleset.vowels.kamatzKatan : ruleset.vowels.kamatzGadol;
      } else if (vowel === MARKS.SEGOL) {
        cluster.vowelName = "segol";
        cluster.vowelOut = ruleset.vowels.segol;
      } else if (vowel === MARKS.TSERE) {
        cluster.vowelName = "tzere";
        cluster.vowelOut = ruleset.vowels.tzere;
      } else if (vowel === MARKS.HIRIQ) {
        cluster.vowelName = "hiriq";
        cluster.vowelOut = ruleset.vowels.hiriq;
      } else if (vowel === MARKS.HOLAM || vowel === MARKS.HOLAM_HASER) {
        cluster.vowelName = "holam";
        cluster.vowelOut = ruleset.vowels.holam;
      } else if (vowel === MARKS.QUBUTS) {
        cluster.vowelName = "kubutz";
        cluster.vowelOut = ruleset.vowels.kubutz;
      } else if (vowel === MARKS.HATAF_PATAH) {
        cluster.vowelName = "chatafPatach";
        cluster.vowelOut = ruleset.vowels.chatafPatach;
      } else if (vowel === MARKS.HATAF_SEGOL) {
        cluster.vowelName = "chatafSegol";
        cluster.vowelOut = ruleset.vowels.chatafSegol;
      } else if (vowel === MARKS.HATAF_QAMATS) {
        cluster.vowelName = "chatafKamatz";
        cluster.vowelOut = ruleset.vowels.chatafKamatz;
      }
    });
  }

  function classifyShevas(clusters, ruleset) {
    clusters.forEach((cluster, index) => {
      if (!hasMark(cluster, MARKS.SHEVA)) {
        return;
      }

      if (
        index === clusters.length - 1 ||
        (
          index === clusters.length - 2 &&
          clusters[index + 1]?.base === "א" &&
          !getVowelMark(clusters[index + 1]) &&
          !hasMark(clusters[index + 1], MARKS.SHEVA)
        )
      ) {
        cluster.sheva = "silent";
        return;
      }

      const previous = clusters[index - 1];
      const isMiddleConsecutiveSheva = Boolean(
        index > 0 &&
        index < clusters.length - 1 &&
        previous &&
        hasMark(previous, MARKS.SHEVA)
      );
      const followsLongVowel = followsLongVowelBeforeSheva(clusters, index, ruleset);
      const undageshedBegadKefatFollowsAmbiguousKamatz = Boolean(
        previous &&
        hasMark(previous, MARKS.QAMATS) &&
        clusters[index + 1] &&
        BEGAD_KEFAT.has(clusters[index + 1].base) &&
        !hasMark(clusters[index + 1], MARKS.DAGESH)
      );
      const finalFormBase = (base) => ({ "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" })[base] || base;
      const firstOfIdenticalLetters = Boolean(
        clusters[index + 1] &&
        finalFormBase(clusters[index + 1].base) === finalFormBase(cluster.base)
      );

      // Intrinsic evidence on the sh'va-bearing consonant remains decisive.
      if (
        index === 0 ||
        isMiddleConsecutiveSheva ||
        hasMark(cluster, MARKS.DAGESH) ||
        firstOfIdenticalLetters
      ) {
        cluster.sheva = "vocal";
        return;
      }

      // In the ָיְ sequence, yod completes the ay diphthong. Its sh'va is
      // silent, but the yod does not turn the preceding kamatz into qatan.
      if (
        ["י", "ו"].includes(cluster.base) &&
        previous &&
        hasMark(previous, MARKS.QAMATS)
      ) {
        cluster.sheva = "silent";
        return;
      }

      // Lev Shalem's explicit qamatz-qatan evidence closes this syllable.
      // It is applied only after the intrinsic rules: a sh'va with dagesh,
      // the second of consecutive sh'vas, or identical letters stays vocal.
      if (previous?.forceKamatzKatan) {
        cluster.sheva = "silent";
        return;
      }

      // Perfect-tense endings close the stem syllable. This remains true when
      // a source places meteg or trope on the preceding long vowel.
      if (precedesVerbSuffix(clusters, index)) {
        cluster.sheva = "silent";
        return;
      }

      if (
        ["כ", "ך"].includes(cluster.base) &&
        clusters[index + 1]?.base === "ך" &&
        clusters[index + 1].wordFinal &&
        hasMark(clusters[index + 1], MARKS.QAMATS)
      ) {
        cluster.sheva = "silent";
        return;
      }

      if (
        cluster.forceVocalSheva ||
        followsLongVowel ||
        undageshedBegadKefatFollowsAmbiguousKamatz
      ) {
        cluster.sheva = "vocal";
        return;
      }

      if (isEtObjectMarkerSuffix(clusters, index)) {
        cluster.sheva = "silent";
        return;
      }

      const tavSecondPersonSuffix =
        cluster.base === "ת" &&
        (
          (
            clusters[index + 1]?.base === "ך" &&
            clusters[index + 1].wordFinal &&
            hasMark(clusters[index + 1], MARKS.QAMATS)
          ) ||
          (
            clusters[index + 1]?.base === "כ" &&
            hasMark(clusters[index + 1], MARKS.SEGOL) &&
            ["ם", "ן"].includes(clusters[index + 2]?.base) &&
            clusters[index + 2]?.wordFinal
          )
        );
      const bSecondPersonSuffix =
        cluster.base === "ב" &&
        (
          (
            clusters[index + 1]?.base === "ך" &&
            clusters[index + 1].wordFinal
          ) ||
          (
            clusters[index + 1]?.base === "כ" &&
            hasMark(clusters[index + 1], MARKS.SEGOL) &&
            ["ם", "ן"].includes(clusters[index + 2]?.base) &&
            clusters[index + 2]?.wordFinal &&
            // Patach in לְבַבְכֶם does not license vocal sh'va. Keep the
            // kamatz contrast and the earlier intrinsic vocal rules intact.
            !(previous && hasPatach(previous))
          )
        );
      const followsInitialPrefix =
        (index === 1 || followsStackedArticle(clusters, index, ruleset)) &&
        previous &&
        isIgnoredInitialPrefix(previous, ruleset);
      const followsVavPatachYod = followsVavPatachYodPrefix(clusters, index);
      const vocal =
        tavSecondPersonSuffix ||
        bSecondPersonSuffix ||
        followsInitialPrefix ||
        followsVavPatachYod ||
        hasStressMarker(cluster);

      cluster.sheva = vocal ? "vocal" : "silent";
    });
  }

  function followsStackedArticle(clusters, index, ruleset) {
    if (
      index !== 2 || clusters[0]?.base !== "ו" ||
      !hasMark(clusters[0], MARKS.SHEVA) ||
      clusters[1]?.base !== "ה" || !hasPatach(clusters[1]) ||
      clusters[index]?.base !== "מ"
    ) {
      return false;
    }
    const stem = clusterLookupKey(clusters, 1);
    // Conjunctive vav must not turn lexical ה (including Aramaic nouns)
    // or an already reviewed silent-prefix form into a Hebrew article.
    return !ruleset?.exceptions?.lexicalInitialHey?.[stem] &&
      !ruleset?.exceptions?.silentInitialPrefixSheva?.[stem];
  }

  function shePrefixStemStart(clusters) {
    const index = clusters[0]?.base === "ו" &&
      hasMark(clusters[0], MARKS.SHEVA) ? 1 : 0;
    const prefix = clusters[index];
    return prefix?.base === "ש" && hasSegol(prefix) &&
      hasMark(prefix, MARKS.SHIN_DOT) && !prefix.lexicalInitialShe
      ? index + 1 : 0;
  }

  function applyMissingMetegKamatzSheva(clusters, word, ruleset) {
    const cleaned = stripTropeAndMeteg(word);
    if (!ruleset.exceptions.missingMetegKamatzSheva?.[cleaned]) {
      return;
    }

    clusters.forEach((cluster, index) => {
      const following = clusters[index + 1];
      if (hasMark(cluster, MARKS.QAMATS) && following && hasMark(following, MARKS.SHEVA)) {
        cluster.forceKamatzGadol = true;
        following.forceVocalSheva = true;
      }
    });
  }

  function applyForcedKamatzGadol(clusters, word, ruleset) {
    const cleaned = stripTropeAndMeteg(word);
    let indices = ruleset.exceptions.forcedKamatzGadol?.[cleaned];
    let preserveExistingStress = false;
    if (!Array.isArray(indices)) {
      const start = shePrefixStemStart(clusters);
      const inherited = start && ruleset.exceptions.forcedKamatzGadol?.[
        clusterLookupKey(clusters, start)
      ];
      if (Array.isArray(inherited)) {
        // Inherit only existing pointed-stem evidence, and only its kamatz
        // positions. This map does not establish vocal sh'va.
        indices = inherited.map((index) => index + start);
      }
    }
    if (!Array.isArray(indices)) {
      indices = ruleset.exceptions.levShalemForcedKamatzGadol?.[cleaned];
      preserveExistingStress = Array.isArray(indices);
    }
    if (!Array.isArray(indices)) {
      return;
    }

    for (const index of indices) {
      const cluster = clusters[index];
      if (
        cluster &&
        hasMark(cluster, MARKS.QAMATS) &&
        !(preserveExistingStress && hasStressMarker(cluster))
      ) {
        cluster.forceKamatzGadol = true;
        cluster.forceKamatzGadolFromMam = true;
      }
    }
  }

  function applyForcedKamatzKatan(clusters, word, ruleset) {
    const cleaned = stripTropeAndMeteg(word);
    const indices = ruleset.exceptions.forcedKamatzKatan?.[cleaned];
    if (!Array.isArray(indices)) {
      return;
    }

    for (const index of indices) {
      const cluster = clusters[index];
      if (
        cluster &&
        hasMark(cluster, MARKS.QAMATS) &&
        !hasStressMarker(cluster)
      ) {
        cluster.forceKamatzKatan = true;
      }
    }
  }

  function forceSilentInitialPrefixSheva(clusters) {
    if (
      clusters[0] &&
      hasMark(clusters[1], MARKS.SHEVA) &&
      !hasMark(clusters[1], MARKS.DAGESH) &&
      clusters[2]?.base !== clusters[1].base
    ) {
      clusters[1].sheva = "silent";
    }
  }

  function applyForcedSilentShevas(clusters, word, ruleset) {
    const indices = ruleset.exceptions.silentShevaByWord?.[stripTropeAndMeteg(word)];
    if (!Array.isArray(indices)) {
      return;
    }
    for (const index of indices) {
      if (clusters[index] && hasMark(clusters[index], MARKS.SHEVA)) {
        clusters[index].sheva = "silent";
      }
    }
  }

  function isEtObjectMarkerSuffix(clusters, index) {
    if (
      index !== 1 ||
      clusters[0]?.base !== "א" ||
      !hasMark(clusters[0], MARKS.SEGOL) ||
      clusters[index]?.base !== "ת"
    ) {
      return false;
    }

    const suffixStart = clusters[index + 1];
    const suffixEnd = clusters[index + 2];

    return (
      (
        suffixStart?.base === "ך" &&
        suffixStart.wordFinal &&
        hasMark(suffixStart, MARKS.QAMATS)
      ) ||
      (
        suffixStart?.base === "כ" &&
        hasMark(suffixStart, MARKS.SEGOL) &&
        ["ם", "ן"].includes(suffixEnd?.base) &&
        suffixEnd.wordFinal
      )
    );
  }

  function precedesVerbSuffix(clusters, index) {
    const tav = clusters[index + 1];

    if (clusters[index + 1]?.base === "נ" && hasShuruk(clusters[index + 2]) && clusters[index + 2].wordFinal) {
      return true;
    }

    if (!tav || tav.base !== "ת" || !hasMark(tav, MARKS.DAGESH)) {
      return false;
    }

    const next = clusters[index + 2];
    if (hasMark(tav, MARKS.HIRIQ) && next?.base === "י" && next.wordFinal) {
      return true;
    }

    if ((hasMark(tav, MARKS.QAMATS) || hasMark(tav, MARKS.SHEVA)) && tav.wordFinal) {
      return true;
    }

    return Boolean(
      hasMark(tav, MARKS.SEGOL) &&
      next &&
      ["ם", "ן"].includes(next.base) &&
      next.wordFinal
    );
  }

  function followsLongVowelBeforeSheva(clusters, index, ruleset) {
    const previous = clusters[index - 1];
    if (!previous) {
      return false;
    }

    if (
      (previous.vowelName === "kamatzGadol" && !previous.forceKamatzGadolFromMam) ||
      previous.vowelName === "tzere" ||
      previous.vowelName === "holam"
    ) {
      return true;
    }

    if (hasShuruk(previous)) {
      if (ruleset?.output?.vocalShevaAfterInitialShuruk) {
        return true;
      }
      if (
        index === 1 &&
        previous.base === "ו" &&
        ["ב", "כ", "ל", "מ"].includes(clusters[index].base) &&
        clusters[index + 1] &&
        !ruleset?.output?.vocalShevaAfterInitialShuruk
      ) {
        return false;
      }

      return !(index === 1 && previous.base === "ו" && !hasStressMarker(previous, true));
    }

    if (previous.base === "ו" && clusters[index - 2]?.vowelName === "holam") {
      return true;
    }

    if (
      previous.base === "י" &&
      // A yod with its own vowel is consonantal, not the mater completing
      // the preceding hiriq. Only a vowel-less, sh'va-less yod makes that
      // hiriq long for purposes of the following sh'va.
      !getVowelMark(previous) &&
      !hasMark(previous, MARKS.SHEVA) &&
      clusters[index - 2]?.vowelName === "hiriq"
    ) {
      return true;
    }

    return false;
  }

  function consonantOutput(cluster, ruleset) {
    const mapping = ruleset.consonants[cluster.base];

    if (cluster.base === "ש") {
      if (hasMark(cluster, MARKS.SIN_DOT)) {
        return cluster.issacharSin ? mapping.sin.repeat(2) : mapping.sin;
      }
      return hasMark(cluster, MARKS.SHIN_DOT) ? mapping.shin : mapping.plain;
    }

    if (typeof mapping === "string") {
      return mapping;
    }

    if (mapping && typeof mapping === "object") {
      return hasMark(cluster, MARKS.DAGESH) ? mapping.dagesh : mapping.plain;
    }

    return "";
  }

  function consonantWithDageshDoubling(clusters, index, ruleset, options) {
    const nonDoublingBases = new Set(["ש", "צ", "ץ"]);
    const consonant = consonantOutput(clusters[index], ruleset);
    if (
      !options.doubleDageshChazak ||
      !consonant ||
      index === 0 ||
      index === clusters.length - 1 ||
      nonDoublingBases.has(clusters[index].base) ||
      followsDashedInitialPrefix(clusters, index, options) ||
      !isDageshChazak(clusters, index)
    ) {
      return consonant;
    }

    return consonant + consonant;
  }

  function isHolamMalei(clusters, vavIndex) {
    const vav = clusters[vavIndex];
    const carrier = clusters[vavIndex - 1];
    return vav?.base === "ו" && hasMark(vav, MARKS.HOLAM) &&
      !hasMark(vav, MARKS.DAGESH) && !hasMark(vav, MARKS.SHEVA) &&
      carrier && !getVowelMark(carrier) && !hasMark(carrier, MARKS.SHEVA);
  }

  function shouldSkipMater(clusters, index) {
    const current = clusters[index];
    const previous = clusters[index - 1];
    if (!previous) {
      return false;
    }

    // The Torah's feminine pronoun is often written הוא and pointed הִוא.
    // Prefixes leave its reading hi intact, including in וְהִוא.
    if (index === clusters.length - 2 && previous.base === "ה" && hasHiriq(previous) &&
        isUnmarkedVav(current) && clusters[index + 1].base === "א" &&
        !getVowelMark(clusters[index + 1]) && !hasMark(clusters[index + 1], MARKS.SHEVA)) {
      return true;
    }

    if (isSuperPleneHolamAlefVav(clusters, index)) {
      return true;
    }

    if (current.base === "י" && !getVowelMark(current) && !hasMark(current, MARKS.SHEVA)) {
      if (hasMark(current, MARKS.DAGESH)) {
        return false;
      }
      const next = clusters[index + 1];
      if (next?.base === "ו") {
        return previous.vowelName === "hiriq" && hasMark(next, MARKS.HOLAM_HASER);
      }

      return (
        previous.vowelName === "tzere" ||
        previous.vowelName === "segol" ||
        previous.vowelName === "patach" ||
        previous.vowelName === "hiriq"
      );
    }

    if (current.base === "ו" && !hasMark(current, MARKS.SHEVA)) {
      return (
        isHolamMalei(clusters, index) ||
        (previous.vowelName === "holam" && isUnmarkedVav(current))
      );
    }

    if (current.base === "א" && !getVowelMark(current) && !hasMark(current, MARKS.SHEVA)) {
      return previous.vowelName === "tzere" && !isHolamMalei(clusters, index + 1);
    }

    return false;
  }

  function adjustedVowelOut(clusters, index) {
    const cluster = clusters[index];
    const next = clusters[index + 1];

    if (
      cluster.base !== "א" &&
      !cluster.vowelName &&
      !hasMark(cluster, MARKS.SHEVA) &&
      next &&
      next.base === "ש" &&
      hasMark(next, MARKS.SHIN_DOT)
    ) {
      return "o";
    }

    if (
      next &&
      next.base === "י" &&
      !getVowelMark(next) &&
      !hasMark(next, MARKS.SHEVA) &&
      !hasMark(next, MARKS.DAGESH) &&
      clusters[index + 2]?.base !== "ו"
    ) {
      if (cluster.vowelName === "tzere") {
        return "ei";
      }
      if (cluster.vowelName === "segol") {
        return "e";
      }
      if (cluster.vowelName === "patach") {
        return "ai";
      }
      if (cluster.vowelName === "hiriq") {
        return "i";
      }
    }

    if (isHolamMalei(clusters, index + 1)) return "o";

    return cluster.vowelOut;
  }

  function outputStressForCluster(clusters, index) {
    const cluster = clusters[index];
    const next = clusters[index + 1];

    const combinedStressKind = () => cluster?.primaryStress || next?.primaryStress
      ? "primary" : displayedStressKind(cluster) || displayedStressKind(next);

    if (isHolamMalei(clusters, index + 1) ||
        (next && cluster.vowelName === "holam" && isUnmarkedVav(next))) {
      return combinedStressKind();
    }

    if (
      cluster.base !== "א" &&
      !cluster.vowelName &&
      !hasMark(cluster, MARKS.SHEVA) &&
      next &&
      next.base === "ש" &&
      hasMark(next, MARKS.SHIN_DOT)
    ) {
      return combinedStressKind();
    }

    return displayedStressKind(cluster);
  }

  function isFurtivePatach(clusters, index) {
    const cluster = clusters[index];
    return (
      cluster.wordFinal && index > 0 && !clusters[index - 1].wordFinal &&
      FINAL_GUTTURALS.has(cluster.base) &&
      hasMark(cluster, MARKS.PATAH) &&
      (cluster.base !== "ה" || hasMark(cluster, MARKS.DAGESH))
    );
  }

  function isFinalYodVav(clusters, index) {
    const vav = clusters[index + 1];
    return (
      index === clusters.length - 2 &&
      clusters[index].base === "י" &&
      !getVowelMark(clusters[index]) &&
      !hasMark(clusters[index], MARKS.SHEVA) &&
      !hasMark(clusters[index], MARKS.DAGESH) &&
      isUnmarkedVav(vav)
    );
  }

  function startsNewVowelAfterSilentGuttural(output, consonant, vowelOut) {
    return consonant === "" && OUTPUT_VOWEL_RE.test(output) && INPUT_VOWEL_RE.test(vowelOut);
  }

  function startsVowelSyllableAfterClosedConsonant(clusters, index, output, consonant, vowelOut) {
    return (
      consonant === "" &&
      INPUT_VOWEL_RE.test(vowelOut) &&
      output.length > 0 &&
      !OUTPUT_VOWEL_RE.test(output) &&
      clusters[index - 1]?.sheva === "silent"
    );
  }

  function startsShurukAfterSilentGutturalAndClosedConsonant(clusters, index, output) {
    const guttural = clusters[index - 1];
    const closedConsonant = clusters[index - 2];
    return Boolean(
      guttural &&
        ["א", "ע"].includes(guttural.base) &&
        !getVowelMark(guttural) &&
        !hasMark(guttural, MARKS.SHEVA) &&
        closedConsonant?.sheva === "silent" &&
        output.length > 0 &&
        !OUTPUT_VOWEL_RE.test(output)
    );
  }

  function outputOptions(ruleset) {
    return {
      vowelSeparator: "·",
      consonantSeparator: "·",
      mappiqHeh: "ḣ",
      conjunctiveShuruk: "u",
      maqafSeparator: "-",
      fusedMaqafWords: [],
      tzereOnConsonantalYod: null,
      clarityConsonantPairs: [],
      undageshedBetHiriqPrefix: false,
      dashedInitialPrefixes: [],
      doubleDageshChazak: false,
      ...(ruleset.output || {})
    };
  }

  function followsDashedInitialPrefix(clusters, index, options) {
    const prefixIndex = index - 1;
    return Boolean(
      prefixIndex >= 0 &&
        options.dashedInitialPrefixes?.includes(initialPrefixValue(clusters, prefixIndex))
    );
  }

  function initialPrefixValue(clusters, index, consonant, vowelOut) {
    if (index < 0 || index >= clusters.length - 1 || clusters[index].lexicalInitial) {
      return "";
    }

    const previousIsVocalShevaPrefix = Boolean(
      index === 1 &&
      ["ב", "כ", "ל", "ו"].includes(clusters[0]?.base) &&
      clusters[0]?.sheva === "vocal"
    );
    const stackedSheAfterMiPrefix = Boolean(
      index === 1 &&
      initialPrefixValue(clusters, 0) === "mi"
    );
    if (index !== 0 && !previousIsVocalShevaPrefix && !stackedSheAfterMiPrefix) {
      return "";
    }

    // A lexical exception makes the following sh'va silent. In that case the
    // opening syllable only resembles a prefix and must not receive a dash.
    if (clusters[index + 1]?.sheva === "silent") {
      return "";
    }

    const cluster = clusters[index];
    if (cluster.base === "ו") {
      if (
        cluster.vowelName === "kamatzGadol" ||
        (
          cluster.vowelName === "patach" &&
          ["א", "ה", "ח", "ע"].includes(clusters[index + 1]?.base)
        )
      ) {
        return "va";
      }

      if (cluster.sheva === "vocal") {
        return "vSheva";
      }

      if (cluster.vowelName === "segol" || cluster.vowelName === "tzere") {
        return "ve";
      }
    }

    if (
      cluster.base === "ש" &&
      !cluster.lexicalInitialShe &&
      hasMark(cluster, MARKS.SHIN_DOT) &&
      cluster.vowelName === "segol"
    ) {
      return "she";
    }

    if (index !== 0) {
      return "";
    }

    if (cluster.base === "ב") {
      const prefixConsonant = hasMark(cluster, MARKS.DAGESH) ? "b" : "v";
      const following = clusters[index + 1];
      if (following.wordFinal && !isSyllableNucleus(following)) return "";
      const fullVowelBoundary = Boolean(
        following?.sheva === "vocal" ||
        hasMark(following, MARKS.DAGESH) ||
        (["א", "ה", "ח", "ע"].includes(following?.base) && getVowelMark(following))
      );

      if (fullVowelBoundary) {
        if (cluster.vowelName === "patach") {
          return `${prefixConsonant}a`;
        }
        if (
          cluster.vowelName === "kamatzGadol" &&
          ["א", "ה", "ח", "ע"].includes(following?.base)
        ) {
          return `${prefixConsonant}a`;
        }
        if (["segol", "tzere"].includes(cluster.vowelName)) {
          return `${prefixConsonant}e`;
        }
        if (cluster.vowelName === "hiriq") {
          return `${prefixConsonant}i`;
        }
      }
    }

    if (
      cluster.base === "ל" &&
      (
        cluster.vowelName === "patach" ||
        (
          cluster.vowelName === "kamatzGadol" &&
          ["א", "ה", "ח", "ע"].includes(clusters[index + 1]?.base) &&
          getVowelMark(clusters[index + 1])
        )
      )
    ) {
      return "la";
    }

    if (
      cluster.base === "ל" &&
      ["segol", "tzere", "hiriq"].includes(cluster.vowelName) &&
      (
        hasMark(clusters[index + 1], MARKS.DAGESH) ||
        ["א", "ה", "ח", "ע"].includes(clusters[index + 1]?.base)
      )
    ) {
      return cluster.vowelName === "hiriq" ? "li" : "le";
    }

    if (
      cluster.base === "כ" &&
      ["patach", "kamatzGadol", "hiriq"].includes(cluster.vowelName) &&
      (
        clusters[index + 1]?.sheva === "vocal" ||
        hasMark(clusters[index + 1], MARKS.DAGESH) ||
        ["א", "ה", "ח", "ע"].includes(clusters[index + 1]?.base)
      )
    ) {
      return cluster.vowelName === "hiriq" ? "ki" : "ka";
    }

    if (cluster.base === "מ" && cluster.vowelName === "hiriq") {
      const finalMaterYod = Boolean(
        clusters.length === 2 &&
        clusters[index + 1]?.base === "י" &&
        clusters[index + 1]?.wordFinal &&
        !getVowelMark(clusters[index + 1]) &&
        !hasMark(clusters[index + 1], MARKS.SHEVA)
      );
      if (finalMaterYod || clusters[index + 1]?.sheva === "silent") {
        return "";
      }
      return "mi";
    }

    if (
      cluster.base === "מ" &&
      cluster.vowelName === "tzere" &&
      ["א", "ה", "ח", "ע", "ר"].includes(clusters[index + 1]?.base)
    ) {
      return "mei";
    }

    if (cluster.base === "ה") {
      if (cluster.vowelName === "patach") {
        const following = clusters[index + 1];
        const lexicalRepeatedRoot = Boolean(
          following?.sheva === "vocal" &&
          !hasMark(following, MARKS.DAGESH) &&
          clusters[index + 2]?.base === following.base &&
          ["ל", "ר"].includes(following.base)
        );
        if (lexicalRepeatedRoot) {
          return "";
        }
        return "ha";
      }

      const following = clusters[index + 1];
      if (cluster.vowelName === "kamatzGadol" && (
        (["א", "ע"].includes(following?.base) && getVowelMark(following)) ||
        (following?.base === "ר" && ["kamatzGadol", "kamatzKatan"].includes(following.vowelName))
      )) {
        return "ha";
      }

      if (
        cluster.vowelName === "segol" &&
        ["א", "ה", "ח", "ע", "ר"].includes(following?.base)
      ) {
        return "he";
      }
    }

    return "";
  }

  function startsConsonantSyllableAfterClosedConsonant(clusters, index, consonant) {
    const previous = clusters[index - 1];
    return Boolean(
      consonant &&
        previous?.sheva === "silent" &&
        clusters[index]?.sheva !== "silent" &&
        index === 2 &&
        hasShuruk(clusters[0])
    );
  }

  function startsConsonantAfterSilentAlef(clusters, index, output, consonant) {
    const previous = clusters[index - 1];
    const beforeAlef = clusters[index - 2];
    return Boolean(
      consonant &&
        previous?.base === "א" &&
        !getVowelMark(previous) &&
        !hasMark(previous, MARKS.SHEVA) &&
        beforeAlef &&
        beforeAlef.vowelName === "kamatzGadol" &&
        OUTPUT_VOWEL_RE.test(output)
    );
  }

  function capitalizeSentenceStarts(text, segments) {
    let offset = 0;
    let segment = 0;
    let shouldCapitalize = true;
    let output = "";

    for (const char of text) {
      if (/[a-z]/i.test(char)) {
        while (segment < segments.length && segments[segment].targetEnd <= offset) segment++;
        const generated = segment < segments.length && segments[segment].targetStart <= offset;
        output += shouldCapitalize && generated ? char.toUpperCase() : char;
        shouldCapitalize = false;
      } else {
        output += char;
        if (char === "\n" || char === "." || char === ":") {
          shouldCapitalize = true;
        } else if (!/\s/.test(char)) {
          shouldCapitalize = false;
        }
      }
      offset += char.length;
    }

    return output;
  }

  function accentFirstVowel(value) {
    return String(value).replace(/[aeiou]/i, (vowel) => `${vowel}\u0301`);
  }

  function stressMarkedVowelGroup(value, override) {
    const text = String(value);
    const matches = Array.from(text.matchAll(/ei|ai|oi|[aeiou]/gi));
    if (!matches.length || !override?.vowelFromEnd) {
      return text;
    }

    const target = matches[matches.length - override.vowelFromEnd];
    if (!target) {
      return text;
    }

    const start = target.index;
    return `${text.slice(0, start)}${accentFirstVowel(text.slice(start))}`;
  }

  function stressMarksFromChunks(chunks) {
    let output = "";
    let markedStressKind = "";

    for (const chunk of chunks) {
      if (!chunk.stressKind) {
        markedStressKind = "";
        output += chunk.value;
      } else if (markedStressKind !== chunk.stressKind && /[aeiou]/i.test(chunk.value)) {
        output += accentFirstVowel(chunk.value);
        markedStressKind = chunk.stressKind;
      } else {
        output += chunk.value;
      }
    }

    return output;
  }

  function estimatedStressMarks(value) {
    const text = String(value);
    const matches = Array.from(text.matchAll(/[aeiou]+/gi));
    if (!matches.length) {
      return text;
    }

    const last = matches[matches.length - 1];
    const previous = matches[matches.length - 2];
    const start = previous ? previous.index + previous[0].length : last.index;
    return `${text.slice(0, start)}${accentFirstVowel(text.slice(start))}`;
  }

  function stressOverrideForWord(word, ruleset) {
    const normalized = normalize(word);
    const cleaned = stripTropeAndMeteg(word);
    const noMarks = stripMarks(word);
    const override = (
      ruleset.exceptions.stressOverrides?.[normalized] ||
      ruleset.exceptions.stressOverrides?.[cleaned] ||
      ruleset.exceptions.stressOverrides?.[noMarks] ||
      null
    );
    return override?.unaccentedOnly && /[\u0591-\u05ae\u05bd]/u.test(normalized) ? null : override;
  }

  function useRuleStressForExactWord(word, ruleset) {
    const normalized = normalize(word);
    const cleaned = stripTropeAndMeteg(word);
    const noMarks = stripMarks(word);
    return Boolean(
      ruleset.exceptions.stressRuleWords?.[normalized] ||
        ruleset.exceptions.stressRuleWords?.[cleaned] ||
        ruleset.exceptions.stressRuleWords?.[noMarks]
    );
  }

  function applyStressOverrideToClusters(clusters, override) {
    if (!override || !Number.isInteger(override.clusterIndex) || !clusters[override.clusterIndex]) {
      return false;
    }

    clusters.forEach((cluster, index) => {
      cluster.primaryStress = index === override.clusterIndex;
      cluster.secondaryStress = false;
    });
    return true;
  }

  function shouldShowStressMarksForClusters(clusters, override) {
    if (override) {
      return true;
    }

    const nuclei = getSyllableNuclei(clusters);
    if (nuclei.length && isFurtivePatach(clusters, clusters.length - 1)) {
      return clusters.some((cluster) => cluster.primaryStress);
    }
    if (nuclei.length <= 1) {
      return false;
    }

    const hasDisplayedSecondary = clusters.some((cluster) =>
      cluster.secondaryStress && (hasDisplayTropeMarker(cluster) || cluster.displaySecondaryStress)
    );
    if (hasDisplayedSecondary) {
      return true;
    }

    const primaryIndex = clusters.findIndex((cluster) => cluster.primaryStress);
    if (primaryIndex < 0) {
      return false;
    }

    const primarySyllable = syllableIndexForCluster(nuclei, primaryIndex, clusters);
    return primarySyllable >= 0 && primarySyllable < nuclei.length - 1;
  }

  function usesStressMarks(format) {
    return format === "stressMarks" || format === "stressMarksAll" || format === "primaryStress" || format === "phonemeStress";
  }

  function transliterateClusters(clusters, ruleset, format = "text") {
    let output = "";
    const chunks = [];
    const options = outputOptions(ruleset);
    const add = (value, stressKind = "", consonant = false) => {
      output += value;
      if (usesStressMarks(format) && value) {
        // The IPA tokenizer reads each Hebrew consonant atomically: e.g. shin is
        // |sh, but a sin followed by he is |s|h. This is never a syllable break.
        chunks.push({
          value: format === "phonemeStress" && consonant ? "|" + value : value,
          stressKind: (format === "primaryStress" || format === "phonemeStress") && stressKind === "secondary" ? "" : stressKind
        });
      }
    };

    clusters.forEach((cluster, index) => {
      if (shouldSkipMater(clusters, index)) {
        return;
      }

      if (index > 0 && isFinalYodVav(clusters, index - 1)) {
        return;
      }

      if (isFinalYodVav(clusters, index)) {
        // Final יו after hiriq is long i plus consonantal v (זִיו, פִּיו,
        // אָחִיו, אָבִיו). After qamatz it is the -av ending (עָלָיו).
        add(
          clusters[index - 1]?.vowelName === "hiriq"
            ? "v"
            : (output.endsWith("a") ? "v" : "av"),
          cluster.primaryStress
        );
        return;
      }

      // A vowelless alef after a full vowel is quiescent (rosh, zot,
      // vayomer), unless it carries the following shuruk or holam malei.
      const previous = clusters[index - 1];
      const quiescentAlef = format === "phonemeStress" && cluster.base === "א" &&
        !getVowelMark(cluster) && !hasMark(cluster, MARKS.SHEVA) && !hasMark(cluster, MARKS.DAGESH) &&
        previous && isSyllableNucleus(previous) && !hasShuruk(clusters[index + 1]) &&
        !isHolamMalei(clusters, index + 1);
      const consonant = quiescentAlef ? "" : consonantWithDageshDoubling(clusters, index, ruleset, options);
      const clusterOutputStress = outputStressForCluster(clusters, index);

      if (
        cluster.base === "ו" &&
        hasMark(cluster, MARKS.HOLAM) &&
        clusters[index - 1]?.base === "י" &&
        !clusters[index - 1]?.vowelName
      ) {
        add(ruleset.vowels.holam, cluster.primaryStress);
        return;
      }

      if (isFurtivePatach(clusters, index)) {
        add(ruleset.vowels.patach);
        if (cluster.base === "ה" && hasMark(cluster, MARKS.DAGESH)) {
          add(options.mappiqHeh, clusterOutputStress, true);
        } else {
          add(consonant, clusterOutputStress, true);
        }
        return;
      }

      if (
        cluster.base === "ו" &&
        hasMark(cluster, MARKS.DAGESH) &&
        !getVowelMark(cluster) &&
        !hasMark(cluster, MARKS.SHEVA)
      ) {
        if (clusters[index + 1]?.base === "ו") {
          add(consonant, clusterOutputStress, true);
          if (isHolamMalei(clusters, index + 1)) add(ruleset.vowels.holam, clusterOutputStress);
          return;
        }

        if (startsShurukAfterSilentGutturalAndClosedConsonant(clusters, index, output)) {
          add(options.vowelSeparator);
        } else if (
          clusters[index - 1] &&
          consonantOutput(clusters[index - 1], ruleset) === "" &&
          OUTPUT_VOWEL_RE.test(output) &&
          options.vowelSeparator
        ) {
          add(options.vowelSeparator);
        }
        add(index === 0 ? options.conjunctiveShuruk : ruleset.vowels.shuruk, cluster.primaryStress);
        return;
      }

      const vowelOut = adjustedVowelOut(clusters, index);
      const styledVowelOut = (
        cluster.base === "י" &&
        cluster.vowelName === "tzere" &&
        options.tzereOnConsonantalYod !== null
      )
        ? options.tzereOnConsonantalYod
        : vowelOut;

      if (
        options.vowelSeparator &&
        (
          startsNewVowelAfterSilentGuttural(output, consonant, styledVowelOut) ||
          startsVowelSyllableAfterClosedConsonant(clusters, index, output, consonant, styledVowelOut)
        )
      ) {
        add(options.vowelSeparator);
      }

      if (
        options.consonantSeparator &&
        (
          startsConsonantSyllableAfterClosedConsonant(clusters, index, consonant)
        )
      ) {
        add(options.consonantSeparator);
      }

      if (
        options.vowelSeparator &&
        startsConsonantAfterSilentAlef(clusters, index, output, consonant)
      ) {
        add(options.vowelSeparator);
      }

      const previousConsonant = clusters[index - 1]
        ? consonantOutput(clusters[index - 1], ruleset)
        : "";
      if (
        clusters[index - 1]?.sheva === "silent" &&
        options.clarityConsonantPairs.includes(`${previousConsonant}|${consonant}`)
      ) {
        add(options.vowelSeparator);
      }

      add(consonant, clusterOutputStress, true);

      if (cluster.base === "ה" && index === clusters.length - 1 && hasMark(cluster, MARKS.DAGESH)) {
        add(options.mappiqHeh.slice(1), clusterOutputStress);
      }

      add(styledVowelOut, clusterOutputStress);

      const prefixValue = initialPrefixValue(clusters, index, consonant, vowelOut);
      const dashedPrefix = options.dashedInitialPrefixes.includes(prefixValue);
      const renderedPrefixSheva = dashedPrefix && cluster.sheva === "vocal";
      if (renderedPrefixSheva) {
        add(ruleset.vowels.segol);
      }
      if (dashedPrefix) {
        add("-");
      }

      if (cluster.sheva === "vocal" && !renderedPrefixSheva) {
        add(ruleset.vowels.vocalSheva, clusterOutputStress);
      }
    });

    return usesStressMarks(format) ? stressMarksFromChunks(chunks) : output;
  }

  class Transliterator {
    constructor(ruleset) {
      this.ruleset = ruleset;
    }

    transliterate(text) {
      return this.transliterateWithAlignment(text).text;
    }

    transliterateWithStressMarks(text) {
      return this.transliterateWithAlignment(text, "stressMarks").text;
    }

    transliterateWithAllStressMarks(text, { primaryOnly = false, forIPA = false } = {}) {
      const format = forIPA ? "phonemeStress" : primaryOnly ? "primaryStress" : "stressMarksAll";
      return this.transliterateTokens(splitInput(text), format);
    }

    expandDivineNameAbbreviations(text) {
      return String(text || "").replace(abbreviatedName, (_name, prefix) => fullName(prefix));
    }

    nameReadingsForSpeech(text) {
      const source = String(text || "");
      return splitInput(source).map(token =>
        token.spokenReading || source.slice(token.sourceStart, token.sourceEnd)
      ).join("");
    }

    pronunciationHebrew(text, options = {}) {
      const tzere = options.tzere === "ei" ? "ei" : "e";
      const speechInput = String(text || "")
        .replace(/[ \t]*\{\s*[פס]\s*\}[ \t]*/gu, " ")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
      return splitInput(speechInput).map((token) => {
        if (token.type === "maqaf") {
          return " ";
        }
        if (token.type === "psik") {
          return "";
        }
        if (token.type === "sofPasuq") {
          return ":";
        }
        if (token.type !== "hebrew" || !hasHebrew(token.value)) {
          return token.value;
        }
        return token.spokenReading || this.pronunciationHebrewWord(token.value, tzere);
      }).join("");
    }

    pronunciationHebrewWord(word, tzere = "e") {
      const cleaned = stripTropeAndMeteg(word);
      const speechCleaned = word
        .normalize("NFD")
        .replace(/[\u05af\u05c4\u05c5]/g, "")
        .normalize("NFC");
      const noMarks = stripMarks(word);
      if (noMarks === "יהוה" || noMarks === "יי") {
        return "אֲדֹנָי";
      }

      const clusters = parseClusters(word);
      if (!hasWordVocalization(clusters)) {
        return speechCleaned;
      }

      markLexicalInitials(clusters, this.ruleset);
      repairMissingHolamMalei(clusters);
      assignStress(clusters, this.ruleset);
      applyMissingMetegKamatzSheva(clusters, word, this.ruleset);
      applyForcedKamatzGadol(clusters, word, this.ruleset);
      applyForcedKamatzKatan(clusters, word, this.ruleset);
      classifyShevas(clusters, this.ruleset);
      applyForcedSilentShevas(clusters, word, this.ruleset);
      classifyVowels(clusters, this.ruleset);
      classifyShevas(clusters, this.ruleset);
      if (this.ruleset.exceptions.silentInitialPrefixSheva?.[cleaned]) {
        forceSilentInitialPrefixSheva(clusters);
      }
      applyForcedSilentShevas(clusters, word, this.ruleset);

      const kolKafIndex = (() => {
        if (clusters.length < 2) {
          return -1;
        }
        const kafIndex = clusters.length - 2;
        const kaf = clusters[kafIndex];
        const lamed = clusters[kafIndex + 1];
        const validPrefixLetters = new Set(["ו", "ה", "ב", "כ", "ל", "מ", "ש", "ד"]);
        const validPrefixes = clusters
          .slice(0, kafIndex)
          .every((prefix) => validPrefixLetters.has(prefix.base));
        return (
          kaf.base === "כ" &&
          lamed.base === "ל" &&
          [MARKS.QAMATS, MARKS.QAMATS_QATAN].some((mark) => hasMark(kaf, mark)) &&
          validPrefixes
        ) ? kafIndex : -1;
      })();

      return clusters.map((cluster, index) => {
        let marks = cluster.marks.filter((mark) => {
          const code = mark.codePointAt(0);
          return code !== 0x05af && code !== 0x05c4 && code !== 0x05c5;
        });
        let suffix = "";
        const consonantalVav = (
          cluster.base === "ו" &&
          !hasShuruk(cluster) &&
          !shouldSkipMater(clusters, index)
        );
        const isFinalPatachChet = Boolean(
          cluster.base === "ח" &&
          index + 1 === clusters.length &&
          clusters[index - 1]?.vowelName === "patach" &&
          !getVowelMark(cluster) &&
          !hasMark(cluster, MARKS.SHEVA)
        );
        const speechBase = consonantalVav ? "ב" : (isFinalPatachChet ? "ך" : cluster.base);
        const isHolamMaterVav = Boolean(
          cluster.base === "ו" &&
          hasMark(cluster, MARKS.HOLAM) &&
          shouldSkipMater(clusters, index)
        );
        const nextIsHolamMaterVav = Boolean(
          clusters[index + 1]?.base === "ו" &&
          hasMark(clusters[index + 1], MARKS.HOLAM) &&
          shouldSkipMater(clusters, index + 1)
        );
        const isSilentFinalKamatzHe = Boolean(
          cluster.base === "ה" &&
          index + 1 === clusters.length &&
          clusters[index - 1]?.vowelName === "kamatzGadol" &&
          cluster.marks.every((mark) => {
            const code = mark.codePointAt(0);
            return code === 0x05af || code === 0x05c4 || code === 0x05c5;
          })
        );
        const isSilentFinalAlef = Boolean(
          cluster.base === "א" &&
          index + 1 === clusters.length &&
          !getVowelMark(cluster) &&
          !hasMark(cluster, MARKS.SHEVA) &&
          cluster.marks.every((mark) => {
            const code = mark.codePointAt(0);
            return code === 0x05af || code === 0x05c4 || code === 0x05c5;
          })
        );
        const nextIsSilentFinalAlef = Boolean(
          clusters[index + 1]?.base === "א" &&
          index + 2 === clusters.length &&
          !getVowelMark(clusters[index + 1]) &&
          !hasMark(clusters[index + 1], MARKS.SHEVA)
        );
        const isSilentYodInAvSuffix = Boolean(
          cluster.base === "י" &&
          !getVowelMark(cluster) &&
          !hasMark(cluster, MARKS.SHEVA) &&
          clusters[index - 1]?.vowelName === "kamatzGadol" &&
          clusters[index + 1]?.base === "ו" &&
          index + 2 === clusters.length
        );
        const needsTzereCarrierBeforeAvSuffix = Boolean(
          cluster.vowelName === "tzere" &&
          clusters[index + 1]?.base === "א" &&
          clusters[index + 1]?.vowelName === "kamatzGadol" &&
          clusters[index + 2]?.base === "י" &&
          clusters[index + 3]?.base === "ו" &&
          index + 4 === clusters.length
        );
        if (isSilentYodInAvSuffix) {
          return "";
        }
        if (isHolamMaterVav) {
          return "";
        }
        if (isSilentFinalKamatzHe) {
          return "";
        }
        if (isSilentFinalAlef) {
          return "";
        }
        if (consonantalVav) {
          marks = marks.filter((mark) => mark !== MARKS.DAGESH);
        }
        if (["ג", "ת", "ק"].includes(speechBase)) {
          marks = marks.filter((mark) => mark !== MARKS.DAGESH);
        }
        if (nextIsSilentFinalAlef && cluster.sheva === "silent") {
          marks = marks.filter((mark) => mark !== MARKS.SHEVA);
        }
        if (nextIsHolamMaterVav && !marks.includes(MARKS.HOLAM)) {
          marks.push(MARKS.HOLAM);
        }

        if (cluster.vowelName === "kamatzKatan" || index === kolKafIndex) {
          marks = marks.filter((mark) => ![MARKS.QAMATS, MARKS.QAMATS_QATAN].includes(mark));
          suffix += `ו${MARKS.HOLAM}`;
        } else if (cluster.sheva === "vocal") {
          marks = marks.filter((mark) => mark !== MARKS.SHEVA);
          marks.push(MARKS.SEGOL);
        } else if (
          cluster.vowelName === "holam" &&
          (cluster.base !== "ו" || consonantalVav) &&
          !nextIsHolamMaterVav
        ) {
          marks = marks.filter((mark) => ![MARKS.HOLAM, MARKS.HOLAM_HASER].includes(mark));
          suffix += `ו${MARKS.HOLAM}`;
        }

        if (needsTzereCarrierBeforeAvSuffix) {
          suffix += tzere === "ei" ? "י" : "ה";
        } else if (cluster.vowelName === "tzere" && tzere === "ei") {
          marks = marks.filter((mark) => mark !== MARKS.TSERE);
          marks.push(MARKS.SEGOL);
          if (clusters[index + 1]?.base !== "י") {
            suffix += "י";
          }
        }

        if (cluster.base === "ש" && cluster.sheva === "silent" && clusters[index + 1]) {
          suffix += " ";
        }

        return `${speechBase}${marks.join("")}${suffix}`.normalize("NFC");
      }).join("");
    }

    transliterateWithAlignment(text, format = "text") {
      const tokens = splitInput(text);
      const segments = [];
      let output = "";

      const appendAligned = (value, token, speechContext = {}) => {
        const targetStart = output.length;
        output += value;
        segments.push({
          sourceStart: token.sourceStart,
          sourceEnd: token.sourceEnd,
          ...(token.spokenReading ? { spokenReading: token.spokenReading } : {}),
          ...speechContext,
          targetStart,
          targetEnd: output.length
        });
      };

      for (let index = 0; index < tokens.length; index += 1) {
        if (this.startsMaqafGroup(tokens, index)) {
          const group = this.collectMaqafGroup(tokens, index);
          const rendered = this.transliterateMaqafParts(group.words, format, group.verseEnd);
          rendered.parts.forEach((part, partIndex) => {
            if (partIndex > 0) {
              output += rendered.separator;
            }
            const sourceToken = tokens[index + (partIndex * 2)];
            const clusters = rendered.clusterGroups[partIndex];
            let speechContext;
            if (partIndex < group.words.length - 1 && clusters.some(c =>
              c.vowelName === "kamatzKatan" && hasMark(c, MARKS.QAMATS))) {
              // A user may select only the unstressed member. Carry its vowel
              // into the selection even when the rest of the maqaf group is absent.
              const letters = sourceToken.value.match(/[א-ת]\p{M}*/gu);
              if (letters?.length === clusters.length) {
                const maqafReading = letters.map((letter, i) => clusters[i].vowelName === "kamatzKatan"
                  ? letter.replace(MARKS.QAMATS, MARKS.QAMATS_QATAN) : letter).join("");
                speechContext = { maqafReading, maqafGroupEnd: tokens[group.endIndex].sourceEnd };
              }
            }
            appendAligned(part, sourceToken, speechContext);
          });
          index = group.endIndex;
        } else {
          const token = tokens[index];
          const rendered = this.transliterateToken(token, format);
          if (token.type === "hebrew" && hasHebrew(token.value)) {
            appendAligned(rendered, token);
          } else {
            output += rendered;
          }
        }
      }

      return {
        text: capitalizeSentenceStarts(output, segments),
        segments
      };
    }

    unvocalizedWords(text) {
      const tokens = splitInput(String(text || "").replace(/\{\s*[פס]\s*\}/gu, ""));
      const words = [];

      for (let index = 0; index < tokens.length; index += 1) {
        if (
          tokens[index].type === "hebrew" &&
          hasHebrew(tokens[index].value) &&
          this.shouldPreserveUnvocalizedWord(tokens[index].value)
        ) {
          words.push(tokens[index].value);
        }
      }

      return words;
    }

    transliterateTokens(tokens, format = "text") {
      let output = "";
      for (let index = 0; index < tokens.length; index += 1) {
        if (this.startsMaqafGroup(tokens, index)) {
          const group = this.collectMaqafGroup(tokens, index);
          output += this.transliterateMaqafGroup(group.words, format, group.verseEnd);
          index = group.endIndex;
        } else {
          output += this.transliterateToken(tokens[index], format);
        }
      }

      return output;
    }

    startsMaqafGroup(tokens, index) {
      return (
        tokens[index]?.type === "hebrew" &&
        tokens[index + 1]?.type === "maqaf" &&
        tokens[index + 2]?.type === "hebrew"
      );
    }

    collectMaqafGroup(tokens, startIndex) {
      const words = [tokens[startIndex].value];
      let index = startIndex;

      while (tokens[index + 1]?.type === "maqaf" && tokens[index + 2]?.type === "hebrew") {
        words.push(tokens[index + 2].value);
        index += 2;
      }

      return { words, endIndex: index, verseEnd: tokens[index].verseEnd };
    }

    transliterateMaqafParts(words, format = "text", verseEnd = false) {
      const options = outputOptions(this.ruleset);
      const clusterGroups = words.map((word) => parseClusters(word));
      const combinedClusters = clusterGroups.flat();
      const normalizedGroup = words.map((word) => stripMarks(word)).join("־");
      const separator = options.fusedMaqafWords.includes(normalizedGroup)
        ? ""
        : options.maqafSeparator;
      assignStress(combinedClusters, this.ruleset, verseEnd);
      const wordFormat =
        format === "stressMarks" && shouldShowStressMarksForClusters(combinedClusters, null)
          ? "stressMarksAll"
          : format;

      return {
        parts: words.map((word, index) =>
          this.transliterateWord(word, clusterGroups[index], true, wordFormat)
        ),
        separator,
        clusterGroups
      };
    }

    transliterateMaqafGroup(words, format = "text", verseEnd = false) {
      const rendered = this.transliterateMaqafParts(words, format, verseEnd);
      return rendered.parts.join(rendered.separator);
    }

    transliterateToken(token, format = "text") {
      if (token.type === "maqaf") {
        return outputOptions(this.ruleset).maqafSeparator;
      }

      if (token.type === "psik") {
        return "";
      }

      if (token.type === "sofPasuq") {
        return ":";
      }

      if (token.type !== "hebrew" || !hasHebrew(token.value)) {
        return token.value;
      }

      return this.transliterateWord(token.value, null, false, format, token.verseEnd);
    }

    transliterateWord(word, clusters = null, stressAssigned = false, format = "text", verseEnd = false) {
      const normalized = normalize(word);
      const cleaned = stripTropeAndMeteg(word);
      const noMarks = stripMarks(word);
      const exact = this.ruleset.exceptions.exactWords[normalized] || this.ruleset.exceptions.exactWords[cleaned];
      const phrase = this.ruleset.exceptions.phraseCapitalization[normalized] || this.ruleset.exceptions.phraseCapitalization[cleaned];
      const canUseNiqqudless = normalized === noMarks || noMarks.includes("יהוה") || noMarks === "יי";
      const niqqudless = canUseNiqqudless ? this.ruleset.exceptions.niqqudless[noMarks] : null;
      const stressOverride = stressOverrideForWord(word, this.ruleset);
      const useRuleStress = clusters && usesStressMarks(format) && useRuleStressForExactWord(word, this.ruleset);
      const markStress = (value) => (
        stressOverride ? stressMarkedVowelGroup(value, stressOverride) : value
      );

      if (exact && !useRuleStress) {
        // An exception supplies a spelling. A cantillation mark can still
        // locate its stressed vowel, including when "ai" spells one vowel.
        if (!stressOverride && usesStressMarks(format) && !niqqudless) {
          const marked = clusters || parseClusters(word);
          const furtive = isFurtivePatach(marked, marked.length - 1);
          if (!stressAssigned) assignStress(marked, this.ruleset, verseEnd);
          const nuclei = getSyllableNuclei(marked);
          const primary = nuclei.findIndex(({ cluster }) => cluster.primaryStress);
          if (primary >= 0 && (furtive || primary < nuclei.length - 1 ||
              (format !== "stressMarks" && /[\u0591-\u05ae\u05bd]/u.test(normalized)))) {
            return stressMarkedVowelGroup(exact, { vowelFromEnd: nuclei.length - primary + Number(furtive) });
          }
        }
        return usesStressMarks(format) ? markStress(exact) : exact;
      }

      if (niqqudless) {
        const reading = noMarks === "מיהוה" || noMarks === "ומיהוה"
          ? niqqudless.replace(/mei?/, "m" + this.ruleset.vowels.tzere)
          : niqqudless;
        return usesStressMarks(format) ? markStress(reading) : reading;
      }

      if (phrase && !this.ruleset.output?.doubleDageshChazak) {
        return usesStressMarks(format) ? markStress(phrase) : phrase;
      }

      const wordClusters = clusters || parseClusters(word);
      if (!hasWordVocalization(wordClusters)) {
        return word;
      }

      markLexicalInitials(wordClusters, this.ruleset);

      repairMissingHolamMalei(wordClusters);
      if (!stressAssigned) {
        assignStress(wordClusters, this.ruleset, verseEnd);
      }
      if (usesStressMarks(format)) {
        applyStressOverrideToClusters(wordClusters, stressOverride);
      }
      applyMissingMetegKamatzSheva(wordClusters, word, this.ruleset);
      applyForcedKamatzGadol(wordClusters, word, this.ruleset);
      applyForcedKamatzKatan(wordClusters, word, this.ruleset);
      classifyShevas(wordClusters, this.ruleset);
      applyForcedSilentShevas(wordClusters, word, this.ruleset);
      classifyVowels(wordClusters, this.ruleset);
      classifyShevas(wordClusters, this.ruleset);
      if (this.ruleset.exceptions.silentInitialPrefixSheva?.[cleaned]) {
        forceSilentInitialPrefixSheva(wordClusters);
      }
      applyForcedSilentShevas(wordClusters, word, this.ruleset);
      if (usesStressMarks(format) && stressOverride?.vowelFromEnd) {
        const spelling = format === "phonemeStress"
          ? transliterateClusters(wordClusters, this.ruleset, format).replace(/\u0301/gu, "")
          : transliterateClusters(wordClusters, this.ruleset);
        return stressMarkedVowelGroup(spelling, stressOverride);
      }
      if (format === "stressMarks" && !shouldShowStressMarksForClusters(wordClusters, stressOverride)) {
        return exact || transliterateClusters(wordClusters, this.ruleset);
      }
      const rendered = transliterateClusters(wordClusters, this.ruleset, format);
      if (exact && useRuleStress) {
        // Keep the style's spelling and transfer the accent by vowel group.
        const nuclei = rendered.match(/[aeiou][aeiou\u0301]*/gi) || [];
        const stressed = nuclei.findIndex((nucleus) => nucleus.includes("\u0301"));
        return stressed < 0 ? exact : stressMarkedVowelGroup(exact, { vowelFromEnd: nuclei.length - stressed });
      }
      return rendered;
    }

    shouldPreserveUnvocalizedWord(word) {
      if (knownUnvocalizedException(word, this.ruleset)) {
        return false;
      }

      const clusters = parseClusters(word);
      return !hasWordVocalization(clusters);
    }
  }

  window.HebrewTransliterator = {
    Transliterator,
    internals: {
      MARKS,
      adjustedVowelOut,
      applyForcedKamatzGadol,
      applyForcedKamatzKatan,
      applyForcedSilentShevas,
      applyMissingMetegKamatzSheva,
      assignStress,
      classifyShevas,
      classifyVowels,
      clusterLookupKey,
      consonantOutput,
      followsDashedInitialPrefix,
      forceSilentInitialPrefixSheva,
      hasShuruk,
      isDageshChazak,
      isFinalYodVav,
      isFurtivePatach,
      isSuperPleneHolamAlefVav,
      outputOptions,
      parseClusters,
      repairMissingHolamMalei,
      shouldRepairMissingHolamMalei,
      shouldSkipMater,
      stripMarks,
      stripTropeAndMeteg,
      transliterateClusters
    }
  };
})();
