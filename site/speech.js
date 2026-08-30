(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HebrewTransliteratorSpeech = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  function prepareText(text) {
    return String(text || "")
      .split("\n")
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

  function selectedOrAll(text, offsets) {
    const value = String(text || "");
    if (
      offsets &&
      Number.isInteger(offsets.start) &&
      Number.isInteger(offsets.end) &&
      offsets.start !== offsets.end
    ) {
      const start = Math.max(0, Math.min(offsets.start, offsets.end));
      const end = Math.min(value.length, Math.max(offsets.start, offsets.end));
      return value.slice(start, end);
    }
    return value;
  }

  function sourceForTargetSelection(sourceText, segments, offsets) {
    const source = String(sourceText || "");
    if (
      !offsets ||
      !Number.isInteger(offsets.start) ||
      !Number.isInteger(offsets.end) ||
      offsets.start === offsets.end
    ) {
      return "";
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
    return source.slice(sourceStart, sourceEnd);
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
    if (selected !== "e") {
      return ruleset;
    }

    const remap = (table) => Object.fromEntries(
      Object.entries(table || {}).map(([key, value]) => [
        key,
        String(value).replace(/Ei/g, "E").replace(/ei/g, "e")
      ])
    );
    ruleset.exceptions = {
      ...(ruleset.exceptions || {}),
      exactWords: remap(ruleset.exceptions?.exactWords),
      niqqudless: remap(ruleset.exceptions?.niqqudless),
      phraseCapitalization: remap(ruleset.exceptions?.phraseCapitalization)
    };
    return ruleset;
  }

  function hebrewVoices(voices) {
    return Array.from(voices || []).filter((voice) =>
      /^(?:he|iw)(?:[-_]|$)/i.test(String(voice?.lang || ""))
    );
  }

  function canonicalHebrew(text) {
    return String(text || "")
      .normalize("NFC")
      .replace(/[ \t]*\{\s*[פס]\s*\}[ \t]*/gu, " ")
      .split("\n")
      .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function speakableHebrewOnly(text, lexicon = []) {
    const recognizedWords = new Set(
      Array.from(lexicon || [], (entry) => String(entry?.grapheme || "").normalize("NFC")).filter(Boolean)
    );
    const tokens = canonicalHebrew(text).match(
      /[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*(?:־[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*)*|[.,!?;:׃–—…]+/gu
    ) || [];
    let result = "";
    for (const token of tokens) {
      if (/^[\u05d0-\u05ea]/u.test(token)) {
        const parts = token.split("־");
        const speakableParts = parts.filter((part) =>
          /[\u05b0-\u05bb\u05c7]/u.test(part) || recognizedWords.has(part.normalize("NFC"))
        );
        if (!speakableParts.length) continue;
        const joined = parts.join("");
        const words = speakableParts.length === parts.length &&
          (parts.length === 1 || recognizedWords.has(joined.normalize("NFC")) || !lexicon.length)
          ? [joined]
          : speakableParts;
        for (const word of words) {
          result += `${result && !result.endsWith(" ") ? " " : ""}${word}`;
        }
      } else if (result) {
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
      .replace(/([eao])\u0301([iy])/gu, "$1$2\u0301");
    const units = [];
    let index = 0;
    while (index < normalized.length) {
      const tail = normalized.slice(index);
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
    ruleset.output.vocalShevaAfterInitialShuruk = true;
    return ruleset;
  }

  function lexiconEntries(text, transliterator) {
    const prepared = canonicalHebrew(text);
    const units = prepared.match(
      /[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*(?:־[\u05d0-\u05ea][\u0591-\u05bd\u05bf-\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea]*)*/gu
    ) || [];
    const entries = new Map();
    const wordEntry = (word) => {
      const grapheme = word.normalize("NFC");
      const rendered = transliterator.transliterateWithAllStressMarks(grapheme);
      const nfd = grapheme.normalize("NFD");
      const preserveFinalH = /ה[^א-ת]*\u05bc[^א-ת]*$/u.test(nfd);
      return { grapheme, phoneme: ipaFromTransliteration(rendered, { preserveFinalH }) };
    };
    for (const unit of units) {
      const parts = unit.split("־");
      const partEntries = parts.map(wordEntry);
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
    audioSourceType
  };
});
