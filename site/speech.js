(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.HebrewTransliteratorSpeech = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  function prepareText(text) {
    return String(text || "")
      .split(/\r\n?|\n/u)
      .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function chunks(text, maximumLength = 240) {
    const prepared = prepareText(text);
    const limit = Number.isInteger(maximumLength) && maximumLength >= 20
      ? maximumLength
      : 240;
    if (!prepared) {
      return [];
    }

    const pieces = prepared.match(/[^.!?:;\n]+[.!?:;]?|\n+/g) || [prepared];
    const result = [];
    let current = "";

    const pushCurrent = () => {
      const trimmed = current.trim();
      if (trimmed) {
        result.push(trimmed);
      }
      current = "";
    };

    for (const piece of pieces) {
      const words = piece.trim().split(/\s+/).filter(Boolean);
      for (const word of words) {
        if (current && `${current} ${word}`.length > limit) {
          pushCurrent();
        }
        if (word.length > limit) {
          pushCurrent();
          for (let index = 0; index < word.length; index += limit) {
            result.push(word.slice(index, index + limit));
          }
        } else {
          current = current ? `${current} ${word}` : word;
        }
      }
      if (/[.!?:;]$/.test(piece.trim()) || /\n/.test(piece)) {
        pushCurrent();
      }
    }
    pushCurrent();
    return result;
  }

  function selectedOrAll(text, offsets, segments = []) {
    const source = String(text || "");
    if (
      offsets &&
      Number.isInteger(offsets.start) &&
      Number.isInteger(offsets.end) &&
      offsets.start !== offsets.end
    ) {
      const value = spokenQereText(source, true);
      const start = Math.max(0, Math.min(offsets.start, offsets.end));
      let end = Math.min(value.length, Math.max(offsets.start, offsets.end));
      // The adjacent sof pasuq identifies silluq in the selected final word.
      if (value[end] === "׃" && segments.some(s => s.sourceStart >= start && s.sourceEnd === end)) end++;
      let cursor = start;
      let reading = "";
      for (const segment of segments) {
        if (segment.sourceStart >= end) break;
        const spoken = segment.spokenReading || (end < segment.maqafGroupEnd && segment.maqafReading);
        if (spoken && segment.sourceStart >= start && segment.sourceEnd <= end &&
            value[segment.sourceStart] !== "\0") {
          reading += value.slice(cursor, segment.sourceStart) + spoken;
          cursor = segment.sourceEnd;
        }
      }
      return (reading + value.slice(cursor, end)).replace(/\0/gu, "");
    }
    return source;
  }

  function sourceForTargetSelection(sourceText, segments, offsets) {
    const source = String(sourceText || "");
    if (
      !offsets ||
      !Number.isInteger(offsets.start) ||
      !Number.isInteger(offsets.end) ||
      offsets.start === offsets.end
    ) {
      return null;
    }

    const start = Math.min(offsets.start, offsets.end);
    const end = Math.max(offsets.start, offsets.end);
    const matching = (segments || []).filter((segment) =>
      segment.targetEnd > start && segment.targetStart < end
    );
    if (!matching.length) {
      return "";
    }

    const sourceStart = Math.min(...matching.map((segment) => segment.sourceStart));
    const sourceEnd = Math.max(...matching.map((segment) => segment.sourceEnd));
    return selectedOrAll(source, { start: sourceStart, end: sourceEnd }, matching);
  }

  const vowelUnits = ["ei", "ai", "oi", "a", "e", "i", "o", "u"];
  const consonantUnits = ["sh", "kh", "ch", "tz"];

  function latinUnits(value) {
    const units = [];
    let index = 0;
    while (index < value.length) {
      const tail = value.slice(index);
      const vowel = vowelUnits.find((candidate) => tail.startsWith(candidate));
      if (vowel) {
        units.push({ type: "vowel", value: vowel });
        index += vowel.length;
        continue;
      }
      const consonant = consonantUnits.find((candidate) => tail.startsWith(candidate));
      if (consonant) {
        units.push({ type: "consonant", value: consonant });
        index += consonant.length;
        continue;
      }
      units.push({ type: "consonant", value: tail[0] });
      index += 1;
    }
    return units;
  }

  function spokenVowel(value) {
    return {
      ei: "ay",
      ai: "eye",
      oi: "oy",
      a: "ah",
      e: "eh",
      i: "ee",
      o: "oh",
      u: "oo"
    }[value] || value;
  }

  function spokenConsonant(value) {
    return { kh: "h", ch: "h", tz: "ts" }[value] || value;
  }

  function renderSyllable(units) {
    return units
      .map((unit) => unit.type === "vowel" ? spokenVowel(unit.value) : spokenConsonant(unit.value))
      .join("")
      .replace(/hh$/i, "h");
  }

  function syllabifyPart(value) {
    const units = latinUnits(value);
    const nuclei = units
      .map((unit, index) => unit.type === "vowel" ? index : -1)
      .filter((index) => index >= 0);
    if (!nuclei.length) {
      return renderSyllable(units);
    }

    const syllables = [];
    let syllableStart = 0;
    for (let index = 0; index < nuclei.length - 1; index += 1) {
      const nucleus = nuclei[index];
      const nextNucleus = nuclei[index + 1];
      const consonantCount = nextNucleus - nucleus - 1;
      // One consonant begins the next syllable. In a cluster, all but the
      // final consonant close the current syllable.
      const syllableEnd = consonantCount <= 1 ? nucleus + 1 : nextNucleus - 1;
      syllables.push(units.slice(syllableStart, syllableEnd));
      syllableStart = syllableEnd;
    }
    syllables.push(units.slice(syllableStart));
    return syllables.map(renderSyllable).filter(Boolean).join("-");
  }

  function phoneticizeWord(value) {
    const plain = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (plain.replace(/[·'’\-]/g, "") === "adonai") {
      return "ah-doh-nye";
    }

    return plain
      .split(/[·'’\-]+/)
      .filter(Boolean)
      .map(syllabifyPart)
      .filter(Boolean)
      .join("-");
  }

  function phoneticize(text) {
    return String(text || "").replace(
      /[A-Za-z\u00c0-\u024f\u0300-\u036f·'’\-]+/g,
      (word) => phoneticizeWord(word)
    );
  }

  function rulesetForTzere(baseRuleset, tzere) {
    const ruleset = JSON.parse(JSON.stringify(baseRuleset || {}));
    const selected = tzere === "e" ? "e" : "ei";
    ruleset.vowels = { ...(ruleset.vowels || {}), tzere: selected };
    return ruleset;
  }

  function hebrewVoices(voices) {
    return Array.from(voices || []).filter((voice) =>
      /^(?:he|iw)(?:[-_]|$)/i.test(String(voice?.lang || ""))
    );
  }

  function canonicalHebrew(text) {
    return String(text || "")
      .replace(/\u034f/gu, "")
      .normalize("NFC")
      .replace(/[ \t]*\{\s*[פס]\s*\}[ \t]*/gu, " ")
      .split(/\r\n?|\n/u)
      .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function spokenQereText(text, keepOffsets = false) {
    // MAM displays the unpointed ketiv in parentheses immediately before
    // the vocalized qere in brackets. Preserve offsets for partial selections.
    return String(text || "").replace(/\([א-ת][א-ת־ \t]*\)[ \t]*\[([א-ת\p{M}־ \t׃]+)\]/gu, (pair, reading) => {
      if (!/[\u05b0-\u05bb\u05c7]|ו\p{M}*\u05bc/u.test(reading)) return pair;
      if (!keepOffsets) return reading;
      return "\0".repeat(pair.indexOf("[") + 1) + reading + "\0";
    });
  }

  function azurePronunciationText(text) {
    return canonicalHebrew(text).replace(/[׳'’]?[א-ת][א-ת\p{M}]*(?:[״"׳'’](?=[א-ת])[א-ת][א-ת\p{M}]*)*[׳'’]?/gu, (word) => {
      const spelling = word.replace(/\p{M}/gu, "").replace(/['’]/gu, "׳");
      switch (spelling.replace(/^׳|׳$/gu, "")) {
        case "הקב״ה":
        case 'הקב"ה':
          return "הַקָּדוֹשׁ בָּרוּךְ הוּא";
        case "ה":
          return word === "ה" ? "אֲדֹנָי" : word;
        default:
          if (/[א-ת][״"׳][א-ת]/u.test(spelling)) return " ";
          return word;
      }
    }).normalize("NFC");
  }

  function speakableHebrewOnly(text, lexicon = [], { joinUnlistedMaqaf = !lexicon?.length } = {}) {
    const recognizedWords = new Set(
      Array.from(lexicon || [], (entry) => String(entry?.grapheme || "").normalize("NFC")).filter(Boolean)
    );
    const passage = canonicalHebrew(text).replace(/\([^()א-ת]*\)|\[[^\[\]א-ת]*\]/gu, " ");
    const tokens = passage.match(
      /[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*(?:־[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*)*|[.,!?;:׃–—…]+|[\p{L}\p{N}]/gu
    ) || [];
    let result = "";
    let ignorePunctuation = false;
    for (const token of tokens) {
      if (/^[\u05d0-\u05ea]/u.test(token)) {
        ignorePunctuation = false;
        const parts = token.split("־");
        const joined = parts.join("").normalize("NFC");
        const joinedRecognized = recognizedWords.has(joined);
        const speakableParts = parts.filter((part) =>
          /[\u05b0-\u05bb\u05c7]/u.test(part) || recognizedWords.has(part.normalize("NFC"))
        );
        if (!joinedRecognized && !speakableParts.length) continue;
        const words = joinedRecognized || (speakableParts.length === parts.length &&
          (parts.length === 1 || joinUnlistedMaqaf))
          ? [joined]
          : speakableParts;
        for (const word of words) {
          result += `${result && !result.endsWith(" ") ? " " : ""}${word}`;
        }
      } else if (/[\p{L}\p{N}]/u.test(token)) {
        ignorePunctuation = true;
      } else if (result && !ignorePunctuation) {
        result = `${result.trimEnd()}${token} `;
      }
    }
    return result.trim();
  }

  function vocalizedHebrewOnly(text) {
    return speakableHebrewOnly(text);
  }

  const ipaVowels = new Map([
    ["ei", "ej"], ["ai", "aj"], ["oi", "oj"],
    ["a", "a"], ["e", "e"], ["i", "i"], ["o", "o"], ["u", "u"]
  ]);
  const ipaConsonants = new Map([
    ["sh", "ʃ"], ["kh", "x"], ["ch", "x"], ["ḥ", "x"], ["ḥ", "x"],
    ["tz", "t͡s"], ["ts", "t͡s"], ["y", "j"], ["r", "ʁ"], ["'", "ʔ"]
  ]);

  function ipaUnits(value) {
    const normalized = String(value || "")
      .normalize("NFD")
      .toLowerCase()
      .replace(/([eao])\u0301i/gu, "$1i\u0301");
    const units = [];
    let index = 0;
    while (index < normalized.length) {
      const tail = normalized.slice(index);
      if (tail[0] === "|") {
        // Consonant boundary from the Hebrew renderer, not a syllable boundary.
        index += 1;
        continue;
      }
      if (tail[0] === "\u0301") {
        if (units.length) {
          units[units.length - 1].stressed = true;
        }
        index += 1;
        continue;
      }
      if (/^[·\-.]/u.test(tail)) {
        units.push({ type: "boundary", value: tail[0] });
        index += 1;
        continue;
      }
      const vowel = [...ipaVowels.keys()].find((candidate) => tail.startsWith(candidate));
      if (vowel) {
        units.push({ type: "vowel", value: ipaVowels.get(vowel), stressed: false });
        index += vowel.length;
        continue;
      }
      const consonant = [...ipaConsonants.keys()].find((candidate) => tail.startsWith(candidate));
      if (consonant) {
        units.push({ type: "consonant", value: ipaConsonants.get(consonant) });
        index += consonant.length;
        continue;
      }
      if (/[a-zʔʃxʁ]/u.test(tail[0])) {
        units.push({ type: "consonant", value: tail[0] });
      }
      index += 1;
    }
    return units;
  }

  function syllabifyIpaUnits(units) {
    const explicit = [];
    let current = [];
    for (const unit of units) {
      if (unit.type === "boundary") {
        if (current.length) {
          explicit.push(current);
          current = [];
        }
      } else {
        current.push(unit);
      }
    }
    if (current.length) {
      explicit.push(current);
    }

    const syllables = [];
    for (const part of explicit) {
      const nuclei = part
        .map((unit, index) => unit.type === "vowel" ? index : -1)
        .filter((index) => index >= 0);
      if (nuclei.length <= 1) {
        if (part.length) syllables.push(part);
        continue;
      }
      let start = 0;
      for (let index = 0; index < nuclei.length - 1; index += 1) {
        const nucleus = nuclei[index];
        const nextNucleus = nuclei[index + 1];
        const consonantCount = nextNucleus - nucleus - 1;
        const end = consonantCount <= 1 ? nucleus + 1 : nextNucleus - 1;
        syllables.push(part.slice(start, end));
        start = end;
      }
      syllables.push(part.slice(start));
    }
    return syllables.filter((syllable) => syllable.some((unit) => unit.type === "vowel"));
  }

  function ipaFromTransliteration(value, options = {}) {
    const syllables = syllabifyIpaUnits(ipaUnits(value));
    if (!syllables.length) {
      return "";
    }
    let stressedIndex = syllables.findIndex((syllable) => syllable.some((unit) => unit.stressed));
    if (stressedIndex < 0) {
      stressedIndex = syllables.length - 1;
    }
    let result = syllables.map((syllable, index) => {
      const rendered = syllable.map((unit) => unit.value).join("");
      return `${index === stressedIndex ? "ˈ" : ""}${rendered}`;
    }).join(".");
    result = result.replace(/ʔ$/u, "");
    if (!options.preserveFinalH) {
      result = result.replace(/(?<=[aeiouj])h$/u, "");
    }
    return result;
  }

  function speechRuleset(baseRuleset, tzere) {
    const ruleset = rulesetForTzere(baseRuleset, tzere);
    ruleset.consonants = {
      ...(ruleset.consonants || {}),
      "א": "'",
      "ע": "'"
    };
    ruleset.output = {
      ...(ruleset.output || {}),
      vowelSeparator: "·",
      consonantSeparator: "·",
      dashedInitialPrefixes: [],
      doubleDageshChazak: false,
      maqafSeparator: " "
    };
    return ruleset;
  }

  function lexiconEntries(text, transliterator) {
    const prepared = canonicalHebrew(text);
    const units = prepared.matchAll(
      /([\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*(?:־[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*)*)(׃?)/gu
    );
    const entries = new Map();
    for (const [, unit, verseEnding] of units) {
      const parts = unit.split("־");
      const rendered = parts.length > 1
        ? transliterator.transliterateMaqafParts(parts, "phonemeStress", Boolean(verseEnding)).parts
        : [transliterator.transliterateWithAllStressMarks(unit + verseEnding, { forIPA: true })];
      const partEntries = parts.map((grapheme, index) => ({
        grapheme,
        phoneme: ipaFromTransliteration(rendered[index], {
          preserveFinalH: /ה[^א-ת]*\u05bc[^א-ת]*$/u.test(grapheme)
        })
      }));
      if (parts.length > 1 && partEntries.every((entry) => entry.phoneme)) {
        const grapheme = parts.join("").normalize("NFC");
        const phoneme = partEntries.map((entry, index) => {
          const value = index < partEntries.length - 1
            ? entry.phoneme.replace(/[ˈˌ]/gu, "")
            : entry.phoneme;
          return value.replace(/^\.+|\.+$/gu, "");
        }).filter(Boolean).join(".").replace(/\.{2,}/gu, ".");
        entries.set(grapheme, { grapheme, phoneme });
      } else {
        for (const entry of partEntries) {
          if (entry.phoneme) entries.set(entry.grapheme, entry);
        }
      }
    }
    return [...entries.values()];
  }

  function audioSourceType(currentText, importedText) {
    const current = canonicalHebrew(currentText);
    const imported = canonicalHebrew(importedText);
    return current && imported && current === imported ? "sefaria" : "arbitrary";
  }

  function distinguishVerseEndings(text) {
    // A PLS lexicon has one reading per spelling. In a mixed passage the same
    // two-meteg word can need different stress in medial and verse-final use.
    if (!text.includes("׃") || !text.includes("\u05bd")) return text;
    const words = /([א-ת][א-ת\p{M}]*)(׃?)/gu;
    const medial = new Set();
    for (const [, word, ending] of text.matchAll(words)) {
      if (!ending && word.indexOf("\u05bd") !== word.lastIndexOf("\u05bd")) medial.add(word);
    }
    if (!medial.size) return text;
    return text.replace(words, (match, word, ending) => {
      if (!ending || !medial.has(word)) return match;
      // Mark the already-stressed silluq with an explicit locating accent in
      // the private synthesis text. All original letters and vowels survive.
      return word.replace(/\u05bd([^\u05bd]*)$/u, "\u05bd\u05a3$1") + ending;
    }).normalize("NFC");
  }

  function prepareAzureHebrew(text, transliterator) {
    // Azure receives the reading itself, including when it does not match a lexicon entry.
    const spoken = distinguishVerseEndings(azurePronunciationText(transliterator.nameReadingsForSpeech(spokenQereText(text))));
    const lexicon = lexiconEntries(spoken, transliterator);
    return { text: speakableHebrewOnly(spoken, lexicon), lexicon };
  }

  return {
    prepareText,
    chunks,
    selectedOrAll,
    sourceForTargetSelection,
    phoneticize,
    phoneticizeWord,
    rulesetForTzere,
    hebrewVoices,
    canonicalHebrew,
    vocalizedHebrewOnly,
    speakableHebrewOnly,
    ipaFromTransliteration,
    speechRuleset,
    lexiconEntries,
    prepareAzureHebrew,
    audioSourceType
  };
});
