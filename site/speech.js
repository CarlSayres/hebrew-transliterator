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

  return {
    prepareText,
    chunks,
    selectedOrAll,
    sourceForTargetSelection,
    phoneticize,
    phoneticizeWord,
    rulesetForTzere,
    hebrewVoices
  };
});
