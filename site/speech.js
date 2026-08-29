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

  return { prepareText, chunks, selectedOrAll };
});
