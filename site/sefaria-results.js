(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HebrewTransliteratorSefaria = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const TANAKH_BOOKS = /^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|I Samuel|II Samuel|I Kings|II Kings|Isaiah|Jeremiah|Ezekiel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Psalms|Proverbs|Job|Song of Songs|Ruth|Lamentations|Ecclesiastes|Esther|Daniel|Ezra|Nehemiah|I Chronicles|II Chronicles)\b/i;

  function normalizeRefKey(ref) {
    return String(ref || "")
      .normalize("NFC")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isTanakhRef(ref) {
    return TANAKH_BOOKS.test(String(ref || "").trim());
  }

  function isLiturgyRef(ref, categories = []) {
    const categoryList = Array.isArray(categories) ? categories : [categories];
    const hasLiturgyCategory = categoryList.some((category) =>
      /^(Liturgy|Siddur|Machzor|Haggadah)$/i.test(String(category || "").trim())
    );
    return hasLiturgyCategory || /^(Siddur|Machzor|Haggadah)\b/i.test(String(ref || "").trim());
  }

  function isCommentaryRef(ref, categories = []) {
    const categoryList = Array.isArray(categories) ? categories : [categories];
    return /\bon\b/i.test(String(ref || "")) || /Commentary/i.test(categoryList.join(" "));
  }

  function isImportableSearchResult(result) {
    const ref = typeof result === "string" ? result : result?.ref;
    const categories = typeof result === "string" ? [] : result?.categories || [];
    const source = typeof result === "string" ? "search" : result?.source;

    if (!ref || isCommentaryRef(ref, categories)) {
      return false;
    }

    if (source === "alias" || source === "schema" || source === "schemaLeaf") {
      return true;
    }

    return isTanakhRef(ref) || isLiturgyRef(ref, categories);
  }

  function resultRank(result, query = "") {
    const ref = String(result?.ref || "");
    const normalizedRef = normalizeRefKey(ref);
    const normalizedQuery = normalizeRefKey(query);

    if (normalizedQuery && normalizedRef === normalizedQuery) {
      return 0;
    }
    if (result?.source === "alias") {
      return 1;
    }
    if (normalizedQuery && normalizedRef.startsWith(normalizedQuery)) {
      return 2;
    }
    if (result?.source === "name") {
      return 3;
    }
    if (isTanakhRef(ref)) {
      return 4;
    }
    if (isLiturgyRef(ref, result?.categories || [])) {
      return 5;
    }
    return 6;
  }

  function prepareResults(results, query = "", limit = 10) {
    const seen = new Set();
    const normalizedQuery = normalizeRefKey(query);
    return (results || [])
      .map((result, index) => ({
        result: typeof result === "string" ? { ref: result, categories: [], source: "search" } : result,
        index
      }))
      .filter(({ result }) => isImportableSearchResult(result))
      .filter(({ result }) => {
        const ref = String(result.ref || "");
        const isBookLevelTanakhResult = isTanakhRef(ref) && !/\d/.test(ref);
        return !isBookLevelTanakhResult || normalizeRefKey(ref) === normalizedQuery;
      })
      .sort((a, b) => resultRank(a.result, query) - resultRank(b.result, query) || a.index - b.index)
      .map(({ result }) => result)
      .filter((result) => {
        const key = normalizeRefKey(result.ref);
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  }

  return {
    isCommentaryRef,
    isImportableSearchResult,
    isLiturgyRef,
    isTanakhRef,
    normalizeRefKey,
    prepareResults,
    resultRank
  };
});
