(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HebrewTransliteratorSefariaCatalog = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const siddurim = Object.freeze([
    {
      ref: "Siddur Ashkenaz",
      tradition: "Ashkenaz",
      coverage: "Full siddur",
      sampleRef: "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Modeh Ani"
    },
    {
      ref: "Siddur Sefard",
      tradition: "Sefard",
      coverage: "Full siddur",
      sampleRef: "Siddur Sefard, Upon Arising, Modeh Ani"
    },
    {
      ref: "Siddur Edot HaMizrach",
      tradition: "Sephardi / Mizrahi",
      coverage: "Full siddur",
      sampleRef: "Siddur Edot HaMizrach, Preparatory Prayers, Modeh Ani"
    },
    {
      ref: "The Koren Shalem Siddur; Ashkenaz",
      tradition: "Ashkenaz",
      coverage: "Full siddur",
      sampleRef: "The Koren Shalem Siddur; Ashkenaz, Weekdays, On Waking"
    },
    {
      ref: "Weekday Siddur Chabad",
      tradition: "Chabad",
      coverage: "Weekday siddur",
      sampleRef: "Weekday Siddur Chabad, Shacharit, Upon Arising"
    },
    {
      ref: "Weekday Siddur Sefard Linear",
      tradition: "Sefard",
      coverage: "Weekday linear siddur",
      sampleRef: "Weekday Siddur Sefard Linear, The Morning Prayers, Upon Arising in the Morning"
    },
    {
      ref: "Shabbat Siddur Sefard Linear",
      tradition: "Sefard",
      coverage: "Shabbat linear siddur",
      sampleRef: "Shabbat Siddur Sefard Linear, Eiruv Tavshilin"
    }
  ]);

  function normalizeQuery(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z\u0590-\u05ff]+/g, " ")
      .trim();
  }

  function isSiddurCatalogQuery(query) {
    return ["siddur", "siddurim", "סידור", "סידורים"].includes(normalizeQuery(query));
  }

  function resultsForQuery(query) {
    if (!isSiddurCatalogQuery(query)) {
      return [];
    }
    return siddurim.map((entry) => ({
      ...entry,
      categories: ["Liturgy", "Siddur", entry.tradition, entry.coverage],
      source: "catalog"
    }));
  }

  return {
    isSiddurCatalogQuery,
    resultsForQuery,
    siddurim
  };
});
