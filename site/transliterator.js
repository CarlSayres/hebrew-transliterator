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
    PASHTA: "\u0599",
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
    return normalize(value).replace(/[\u0591-\u05af\u05bd]/g, "");
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

  function splitInput(text) {
    const normalized = normalize(text);
    const tokens = [];
    let buffer = "";
    let mode = null;

    for (const char of normalized) {
      let nextMode = "other";
      if (char === MAQAF) {
        nextMode = "maqaf";
      } else if (char === PSIK) {
        nextMode = "psik";
      } else if (char === SOF_PASUQ) {
        nextMode = "sofPasuq";
      } else if (/[\u0591-\u05bd\u05bf-\u05c7\u05d0-\u05ea]/.test(char)) {
        nextMode = "hebrew";
      }

      if (mode && nextMode !== mode) {
        tokens.push({ type: mode, value: buffer });
        buffer = "";
      }
      mode = nextMode;
      buffer += char;
    }

    if (buffer) {
      tokens.push({ type: mode, value: buffer });
    }

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

  function hasMark(cluster, mark) {
    return cluster.marks.includes(mark);
  }

  function hasAnyMark(cluster, marks) {
    return cluster.marks.some((mark) => marks.has(mark));
  }

  function hasStressMarker(cluster) {
    return cluster.marks.some((mark) => {
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
    return cluster.base === "ו" && hasMark(cluster, MARKS.DAGESH) && !getVowelMark(cluster) && !hasMark(cluster, MARKS.SHEVA);
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

  function isIgnoredInitialPrefix(cluster) {
    if (!cluster) {
      return false;
    }

    return (
      (cluster.base === "כ" && hasMark(cluster, MARKS.DAGESH) && hasPatach(cluster)) ||
      (cluster.base === "מ" && hasHiriq(cluster)) ||
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

  function shouldRepairMissingHolamMalei(clusters, index) {
    const previous = clusters[index - 1];
    if (
      index === 0 ||
      !isUnmarkedVav(clusters[index]) ||
      !previous ||
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
      .filter(({ cluster, index }) => isSyllableNucleus(cluster) || isStressShevaNucleus(clusters, index));
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

  function assignStress(clusters) {
    const nuclei = getSyllableNuclei(clusters);
    if (!nuclei.length) {
      return;
    }

    const lastSyllable = nuclei.length - 1;
    const penultimateSyllable = nuclei.length - 2;
    const markedSyllables = new Set();
    const syllableMarks = new Map();
    const pashtaIndexes = clusters
      .map((cluster, index) => hasMark(cluster, MARKS.PASHTA) ? index : -1)
      .filter((index) => index >= 0);
    const rightmostPashtaIndex = pashtaIndexes.length ? pashtaIndexes[0] : -1;

    clusters.forEach((cluster, index) => {
      if (!hasStressMarker(cluster)) {
        return;
      }
      if (hasMark(cluster, MARKS.PASHTA) && index !== rightmostPashtaIndex) {
        return;
      }

      const syllableIndex = stressMarkerSyllableIndex(clusters, nuclei, index);
      if (syllableIndex >= 0) {
        markedSyllables.add(syllableIndex);
        const marks = syllableMarks.get(syllableIndex) || { meteg: false, trope: false, forwardedSheva: false };
        marks.meteg = marks.meteg || hasMeteg(cluster);
        marks.trope = marks.trope || hasDisplayTropeMarker(cluster);
        marks.forwardedSheva = marks.forwardedSheva || isForwardedShevaStressMarker(clusters, index);
        syllableMarks.set(syllableIndex, marks);
      }
    });

    let primarySyllable = lastSyllable;
    if (syllableMarks.get(lastSyllable)?.trope) {
      primarySyllable = lastSyllable;
    } else if (
      penultimateSyllable >= 0 &&
      syllableMarks.get(penultimateSyllable)?.trope &&
      !syllableMarks.get(penultimateSyllable)?.forwardedSheva
    ) {
      primarySyllable = penultimateSyllable;
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
    if (index !== 1 || isArticlePrefixBeforeDagesh(clusters, index)) {
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

    const allowedPrefixLetters = new Set(["ו", "ב", "כ", "ל", "מ", "ה", "ש"]);
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
          isKolFamilyKamatz(clusters, index) ||
          (
            !finalKha &&
            !hasStressMarker(cluster) &&
            !cluster.forceKamatzGadol &&
            !isKamatzBeforeSilentAlef(clusters, index) &&
            !isKamatzBeforeYodSheva(clusters, index) &&
            isClosedUnstressedSyllable(clusters, index)
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

  function classifyShevas(clusters) {
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
      const followsLongVowel = followsLongVowelBeforeSheva(clusters, index);
      const undageshedBegadKefatFollowsAmbiguousKamatz = Boolean(
        previous &&
        hasMark(previous, MARKS.QAMATS) &&
        clusters[index + 1] &&
        BEGAD_KEFAT.has(clusters[index + 1].base) &&
        !hasMark(clusters[index + 1], MARKS.DAGESH)
      );
      const firstOfIdenticalLetters = Boolean(
        clusters[index + 1] && clusters[index + 1].base === cluster.base
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
        cluster.base === "י" &&
        previous &&
        hasMark(previous, MARKS.QAMATS)
      ) {
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
            clusters[index + 2]?.wordFinal
          )
        );
      const followsInitialPrefix =
        index === 1 &&
        previous &&
        isIgnoredInitialPrefix(previous);
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

  function forceSilentInitialPrefixSheva(clusters) {
    if (
      clusters[0] &&
      hasMark(clusters[1], MARKS.SHEVA) &&
      !hasMark(clusters[1], MARKS.DAGESH)
    ) {
      clusters[1].sheva = "silent";
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

  function followsLongVowelBeforeSheva(clusters, index) {
    const previous = clusters[index - 1];
    if (!previous) {
      return false;
    }

    if (
      previous.vowelName === "kamatzGadol" ||
      previous.vowelName === "tzere" ||
      previous.vowelName === "holam"
    ) {
      return true;
    }

    if (hasShuruk(previous)) {
      if (
        index === 1 &&
        previous.base === "ו" &&
        ["ב", "כ", "ל", "מ"].includes(clusters[index].base) &&
        clusters[index + 1]
      ) {
        return false;
      }

      return !(index === 1 && previous.base === "ו" && !hasStressMarker(previous));
    }

    if (previous.base === "ו" && clusters[index - 2]?.vowelName === "holam") {
      return true;
    }

    if (previous.base === "י" && clusters[index - 2]?.vowelName === "hiriq") {
      return true;
    }

    return false;
  }

  function consonantOutput(cluster, ruleset) {
    const mapping = ruleset.consonants[cluster.base];

    if (cluster.base === "ש") {
      if (hasMark(cluster, MARKS.SIN_DOT)) {
        return mapping.sin;
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

  function inferredUnvocalizedHolamWord(clusters, ruleset) {
    if (
      clusters.length !== 3 ||
      clusters[1].base !== "ו" ||
      clusters.some((cluster) => cluster.marks.length > 0)
    ) {
      return "";
    }

    const first = consonantOutput(clusters[0], ruleset);
    const last = consonantOutput(clusters[2], ruleset);
    if (!last) {
      return "";
    }

    return `${first}o${last}`;
  }

  function shouldSkipMater(clusters, index) {
    const current = clusters[index];
    const previous = clusters[index - 1];
    if (!previous) {
      return false;
    }

    if (current.base === "י" && !getVowelMark(current) && !hasMark(current, MARKS.SHEVA)) {
      if (hasMark(current, MARKS.DAGESH) || clusters[index + 1]?.base === "ו") {
        return false;
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
        (hasMark(current, MARKS.HOLAM) && !hasMark(previous, MARKS.SHEVA)) ||
        (previous.vowelName === "holam" && !getVowelMark(current))
      );
    }

    if (current.base === "א" && !getVowelMark(current) && !hasMark(current, MARKS.SHEVA)) {
      return previous.vowelName === "tzere";
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

    if (next && next.base === "ו" && !hasMark(next, MARKS.SHEVA)) {
      if (cluster.vowelName === "holam" || (hasMark(next, MARKS.HOLAM) && !hasMark(cluster, MARKS.SHEVA))) {
        return "o";
      }
    }

    return cluster.vowelOut;
  }

  function outputStressForCluster(clusters, index) {
    const cluster = clusters[index];
    const next = clusters[index + 1];

    const combinedStressKind = () => displayedStressKind(cluster) || displayedStressKind(next);

    if (
      next &&
      next.base === "ו" &&
      !hasMark(next, MARKS.SHEVA) &&
      (cluster.vowelName === "holam" || (hasMark(next, MARKS.HOLAM) && !hasMark(cluster, MARKS.SHEVA)))
    ) {
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
      index === clusters.length - 1 &&
      FINAL_GUTTURALS.has(cluster.base) &&
      hasMark(cluster, MARKS.PATAH)
    );
  }

  function isFinalYodVav(clusters, index) {
    const vav = clusters[index + 1];
    return (
      index === clusters.length - 2 &&
      clusters[index].base === "י" &&
      vav.base === "ו" &&
      !hasMark(vav, MARKS.DAGESH) &&
      !hasMark(vav, MARKS.HOLAM) &&
      !hasMark(vav, MARKS.HOLAM_HASER)
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

  function outputOptions(ruleset) {
    return {
      vowelSeparator: "·",
      consonantSeparator: "·",
      mappiqHeh: "ḣ",
      conjunctiveShuruk: "u",
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
    if (index < 0 || index >= clusters.length - 1) {
      return "";
    }

    const stackedSheAfterShevaPrefix = Boolean(
      index === 1 &&
      ["ב", "כ", "ל", "ו"].includes(clusters[0]?.base) &&
      clusters[0]?.sheva === "vocal"
    );
    if (index !== 0 && !stackedSheAfterShevaPrefix) {
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

      if (
        cluster.sheva === "vocal" ||
        cluster.vowelName === "segol" ||
        cluster.vowelName === "tzere"
      ) {
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

    if (
      cluster.base === "ב" &&
      hasMark(cluster, MARKS.DAGESH) &&
      cluster.vowelName === "patach"
    ) {
      return "ba";
    }

    if (
      cluster.base === "ב" &&
      hasMark(cluster, MARKS.DAGESH) &&
      cluster.vowelName === "kamatzGadol" &&
      clusters[index + 1]?.base === "א"
    ) {
      return "ba";
    }

    if (cluster.base === "ל" && cluster.vowelName === "patach") {
      return "la";
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

    if (cluster.base === "ה") {
      if (cluster.vowelName === "patach") {
        return "ha";
      }

      const following = clusters[index + 1];
      if (
        cluster.vowelName === "kamatzGadol" &&
        ["א", "ע", "ר"].includes(following?.base) &&
        ["kamatzGadol", "kamatzKatan"].includes(following?.vowelName)
      ) {
        return "ha";
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

  function capitalizeSentenceStarts(text) {
    let shouldCapitalize = true;
    let output = "";

    for (const char of text) {
      if (/[a-z]/i.test(char)) {
        output += shouldCapitalize ? char.toUpperCase() : char;
        shouldCapitalize = false;
      } else {
        output += char;
        if (char === "\n" || char === "." || char === ":") {
          shouldCapitalize = true;
        } else if (!/\s/.test(char)) {
          shouldCapitalize = false;
        }
      }
    }

    return output;
  }

  function accentFirstVowel(value) {
    return String(value).replace(/[aeiou]/i, (vowel) => `${vowel}\u0301`);
  }

  function stressMarkedVowelGroup(value, override) {
    const text = String(value);
    const matches = Array.from(text.matchAll(/[aeiou]+/gi));
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
    return (
      ruleset.exceptions.stressOverrides?.[normalized] ||
      ruleset.exceptions.stressOverrides?.[cleaned] ||
      ruleset.exceptions.stressOverrides?.[noMarks] ||
      null
    );
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

  function transliterateClusters(clusters, ruleset, format = "text") {
    let output = "";
    const chunks = [];
    const options = outputOptions(ruleset);
    const add = (value, stressKind = "") => {
      output += value;
      if ((format === "stressMarks" || format === "stressMarksAll") && value) {
        chunks.push({ value, stressKind });
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
        add(output.endsWith("a") ? "v" : "av", cluster.primaryStress);
        return;
      }

      const consonant = consonantWithDageshDoubling(clusters, index, ruleset, options);
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
        add(ruleset.vowels.patach, clusterOutputStress);
        if (cluster.base === "ה" && hasMark(cluster, MARKS.DAGESH)) {
          add(options.mappiqHeh, clusterOutputStress);
        } else {
          add(consonant, clusterOutputStress);
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
          add(consonant, cluster.primaryStress);
          return;
        }

        if (
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

      if (
        options.vowelSeparator &&
        (
          startsNewVowelAfterSilentGuttural(output, consonant, vowelOut) ||
          startsVowelSyllableAfterClosedConsonant(clusters, index, output, consonant, vowelOut)
        )
      ) {
        add(options.vowelSeparator);
      }

      if (
        options.consonantSeparator &&
        (
          startsConsonantSyllableAfterClosedConsonant(clusters, index, consonant) ||
          startsConsonantAfterSilentAlef(clusters, index, output, consonant)
        )
      ) {
        add(options.consonantSeparator);
      }

      add(consonant, clusterOutputStress);

      if (cluster.base === "ה" && index === clusters.length - 1 && hasMark(cluster, MARKS.DAGESH)) {
        add(options.mappiqHeh.slice(1), clusterOutputStress);
      }

      add(vowelOut, clusterOutputStress);

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

    return (format === "stressMarks" || format === "stressMarksAll") ? stressMarksFromChunks(chunks) : output;
  }

  class Transliterator {
    constructor(ruleset) {
      this.ruleset = ruleset;
    }

    transliterate(text) {
      const transliterated = this.transliterateTokens(splitInput(text));
      return capitalizeSentenceStarts(transliterated);
    }

    transliterateWithStressMarks(text) {
      const transliterated = this.transliterateTokens(splitInput(text), "stressMarks");
      return capitalizeSentenceStarts(transliterated);
    }

    unvocalizedWords(text) {
      const tokens = splitInput(text);
      const words = [];

      for (let index = 0; index < tokens.length; index += 1) {
        const lamedHeyApostropheSuffix = this.lamedHeyApostropheDivineNameSuffix(tokens, index);
        const heyApostropheSuffix = this.heyApostropheDivineNameSuffix(tokens, index);
        const apostropheHeyPrefix = this.apostropheHeyDivineNamePrefix(tokens, index);
        if (lamedHeyApostropheSuffix !== null) {
          index += 1;
          continue;
        }
        if (heyApostropheSuffix !== null) {
          index += 1;
          continue;
        }
        if (apostropheHeyPrefix !== null) {
          index += 1;
          continue;
        }

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
      const word = (value) => value;
      const literal = (value) => value;

      for (let index = 0; index < tokens.length; index += 1) {
        const lamedHeyApostropheSuffix = this.lamedHeyApostropheDivineNameSuffix(tokens, index);
        const heyApostropheSuffix = this.heyApostropheDivineNameSuffix(tokens, index);
        const apostropheHeyPrefix = this.apostropheHeyDivineNamePrefix(tokens, index);
        if (lamedHeyApostropheSuffix !== null) {
          output += word("Ladonai") + literal(lamedHeyApostropheSuffix);
          index += 1;
        } else if (heyApostropheSuffix !== null) {
          output += word("Adonai") + literal(heyApostropheSuffix);
          index += 1;
        } else if (apostropheHeyPrefix !== null) {
          output += literal(apostropheHeyPrefix) + word("Adonai");
          index += 1;
        } else if (this.startsMaqafGroup(tokens, index)) {
          const group = this.collectMaqafGroup(tokens, index);
          output += this.transliterateMaqafGroup(group.words, format);
          index = group.endIndex;
        } else {
          output += this.transliterateToken(tokens[index], format);
        }
      }

      return output;
    }

    lamedHeyApostropheDivineNameSuffix(tokens, index) {
      if (
        tokens[index]?.type === "hebrew" &&
        stripMarks(tokens[index].value) === "לה" &&
        tokens[index + 1]?.type === "other" &&
        /^[׳'’]/.test(tokens[index + 1].value)
      ) {
        return tokens[index + 1].value.slice(1);
      }

      return null;
    }

    startsHeyApostropheDivineName(tokens, index) {
      return (
        this.heyApostropheDivineNameSuffix(tokens, index) !== null
      );
    }

    heyApostropheDivineNameSuffix(tokens, index) {
      if (
        tokens[index]?.type === "hebrew" &&
        stripMarks(tokens[index].value) === "ה" &&
        tokens[index + 1]?.type === "other" &&
        /^[׳'’]/.test(tokens[index + 1].value)
      ) {
        return tokens[index + 1].value.slice(1);
      }

      return null;
    }

    startsApostropheHeyDivineName(tokens, index) {
      return (
        this.apostropheHeyDivineNamePrefix(tokens, index) !== null
      );
    }

    apostropheHeyDivineNamePrefix(tokens, index) {
      if (
        tokens[index]?.type !== "other" ||
        !/[׳'’]$/.test(tokens[index].value) ||
        tokens[index + 1]?.type !== "hebrew" ||
        stripMarks(tokens[index + 1].value) !== "ה"
      ) {
        return null;
      }

      return tokens[index].value.slice(0, -1);
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

      return { words, endIndex: index };
    }

    transliterateMaqafGroup(words, format = "text") {
      const clusterGroups = words.map((word) => parseClusters(word));
      const combinedClusters = clusterGroups.flat();
      assignStress(combinedClusters);
      const wordFormat =
        format === "stressMarks" && shouldShowStressMarksForClusters(combinedClusters, null)
          ? "stressMarksAll"
          : format;

      return words
        .map((word, index) => this.transliterateWord(word, clusterGroups[index], true, wordFormat))
        .join("-");
    }

    transliterateToken(token, format = "text") {
      if (token.type === "maqaf") {
        return "-";
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

      return this.transliterateWord(token.value, null, false, format);
    }

    transliterateWord(word, clusters = null, stressAssigned = false, format = "text") {
      const normalized = normalize(word);
      const cleaned = stripTropeAndMeteg(word);
      const noMarks = stripMarks(word);
      const exact = this.ruleset.exceptions.exactWords[normalized] || this.ruleset.exceptions.exactWords[cleaned];
      const phrase = this.ruleset.exceptions.phraseCapitalization[normalized] || this.ruleset.exceptions.phraseCapitalization[cleaned];
      const canUseNiqqudless = normalized === noMarks || noMarks.includes("יהוה") || noMarks === "יי";
      const niqqudless = canUseNiqqudless ? this.ruleset.exceptions.niqqudless[noMarks] : null;
      const stressOverride = stressOverrideForWord(word, this.ruleset);
      const useRuleStress = clusters && (format === "stressMarks" || format === "stressMarksAll") && useRuleStressForExactWord(word, this.ruleset);
      const markStress = (value) => (
        stressOverride ? stressMarkedVowelGroup(value, stressOverride) : value
      );

      if (exact && !useRuleStress) {
        return format === "stressMarks" ? markStress(exact) : exact;
      }

      if (niqqudless) {
        return format === "stressMarks" ? markStress(niqqudless) : niqqudless;
      }

      if (phrase) {
        return format === "stressMarks" ? markStress(phrase) : phrase;
      }

      const wordClusters = clusters || parseClusters(word);
      if (!hasWordVocalization(wordClusters)) {
        const inferred = inferredUnvocalizedHolamWord(wordClusters, this.ruleset);
        if (inferred) {
          return inferred;
        }
        return word;
      }

      for (let index = 0; index < wordClusters.length; index += 1) {
        if (wordClusters[index].base === "ש") {
          wordClusters[index].lexicalInitialShe = Boolean(
            this.ruleset.exceptions.lexicalInitialShe?.[clusterLookupKey(wordClusters, index)]
          );
        }
      }

      repairMissingHolamMalei(wordClusters);
      if (!stressAssigned) {
        assignStress(wordClusters);
      }
      if (format === "stressMarks" || format === "stressMarksAll") {
        applyStressOverrideToClusters(wordClusters, stressOverride);
      }
      applyMissingMetegKamatzSheva(wordClusters, word, this.ruleset);
      classifyShevas(wordClusters);
      classifyVowels(wordClusters, this.ruleset);
      classifyShevas(wordClusters);
      if (this.ruleset.exceptions.silentInitialPrefixSheva?.[cleaned]) {
        forceSilentInitialPrefixSheva(wordClusters);
      }
      if ((format === "stressMarks" || format === "stressMarksAll") && stressOverride?.vowelFromEnd) {
        return stressMarkedVowelGroup(transliterateClusters(wordClusters, this.ruleset), stressOverride);
      }
      if (format === "stressMarks" && !shouldShowStressMarksForClusters(wordClusters, stressOverride)) {
        return transliterateClusters(wordClusters, this.ruleset);
      }
      return transliterateClusters(wordClusters, this.ruleset, format);
    }

    shouldPreserveUnvocalizedWord(word) {
      if (knownUnvocalizedException(word, this.ruleset)) {
        return false;
      }

      const clusters = parseClusters(word);
      return !hasWordVocalization(clusters) && !inferredUnvocalizedHolamWord(clusters, this.ruleset);
    }
  }

  window.HebrewTransliterator = {
    Transliterator,
    internals: {
      MARKS,
      assignStress,
      parseClusters,
      stripMarks,
      stripTropeAndMeteg
    }
  };
})();
