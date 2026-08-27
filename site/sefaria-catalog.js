(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HebrewTransliteratorSefariaCatalog = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const siddurim = [
    ["Siddur Ashkenaz", "Ashkenaz", "Full siddur", "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Modeh Ani"],
    ["Siddur Sefard", "Sefard", "Full siddur", "Siddur Sefard, Upon Arising, Modeh Ani"],
    ["Siddur Edot HaMizrach", "Sephardi / Mizrahi", "Full siddur", "Siddur Edot HaMizrach, Preparatory Prayers, Modeh Ani"],
    ["The Koren Shalem Siddur; Ashkenaz", "Ashkenaz", "Full siddur", "The Koren Shalem Siddur; Ashkenaz, Weekdays, On Waking"],
    ["Weekday Siddur Chabad", "Chabad", "Weekday siddur", "Weekday Siddur Chabad, Shacharit, Upon Arising"],
    ["Weekday Siddur Sefard Linear", "Sefard", "Weekday linear siddur", "Weekday Siddur Sefard Linear, The Morning Prayers, Upon Arising in the Morning"],
    ["Shabbat Siddur Sefard Linear", "Sefard", "Shabbat linear siddur", "Shabbat Siddur Sefard Linear, Eiruv Tavshilin"]
  ].map(([ref, tradition, coverage, sampleRef]) => ({ ref, tradition, coverage, sampleRef }));

  const mahzorim = [
    ["Machzor Rosh Hashanah Ashkenaz", "Ashkenaz", "Rosh Hashanah", "Machzor Rosh Hashanah Ashkenaz, Annullment of Vows"],
    ["Machzor Rosh Hashanah Ashkenaz Linear", "Ashkenaz", "Rosh Hashanah linear", "Machzor Rosh Hashanah Ashkenaz Linear, Annullment of Vows"],
    ["Machzor Rosh Hashanah Edot HaMizrach", "Sephardi / Mizrahi", "Rosh Hashanah", "Machzor Rosh Hashanah Edot HaMizrach, Annulment of Vows and Curses"],
    ["Machzor Rosh Hashanah Sefard", "Sefard", "Rosh Hashanah", "Machzor Rosh Hashanah Sefard, Maariv, Amidah"],
    ["Machzor Yom Kippur Ashkenaz", "Ashkenaz", "Yom Kippur", "Machzor Yom Kippur Ashkenaz, Kaporos"],
    ["Machzor Yom Kippur Ashkenaz Linear", "Ashkenaz", "Yom Kippur linear", "Machzor Yom Kippur Ashkenaz Linear, Kaporos"],
    ["Machzor Yom Kippur Edot HaMizrach", "Sephardi / Mizrahi", "Yom Kippur", "Machzor Yom Kippur Edot HaMizrach, Kapparot"],
    ["Machzor Yom Kippur Sefard", "Sefard", "Yom Kippur", "Machzor Yom Kippur Sefard, Kapparot"],
    ["The Koren Rosh HaShana Mahzor; Ashkenaz", "Ashkenaz", "Rosh Hashanah", "The Koren Rosh HaShana Mahzor; Ashkenaz, Ma'ariv for Rosh HaShana"],
    ["The Koren Yom Kippur Mahzor; Ashkenaz", "Ashkenaz", "Yom Kippur", "The Koren Yom Kippur Mahzor; Ashkenaz, Yom Kippur Evening, Ma'ariv for Yom Kippur"]
  ].map(([ref, tradition, coverage, sampleRef]) => ({ ref, tradition, coverage, sampleRef }));

  const haggadot = [
    ["Pesach Haggadah", "General", "Passover Haggadah", "Pesach Haggadah, Kadesh"],
    ["Pesach Haggadah Edot Hamizrah", "Sephardi / Mizrahi", "Passover Haggadah", "Pesach Haggadah Edot Hamizrah, Kadesh"]
  ].map(([ref, tradition, coverage, sampleRef]) => ({ ref, tradition, coverage, sampleRef }));

  const tanakhCollections = {
    torah: [
      ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34]
    ],
    neviim: [
      ["Joshua", 24], ["Judges", 21], ["I Samuel", 31], ["II Samuel", 24],
      ["I Kings", 22], ["II Kings", 25], ["Isaiah", 66], ["Jeremiah", 52],
      ["Ezekiel", 48], ["Hosea", 14], ["Joel", 4], ["Amos", 9], ["Obadiah", 1],
      ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3], ["Zephaniah", 3],
      ["Haggai", 2], ["Zechariah", 14], ["Malachi", 3]
    ],
    ketuvim: [
      ["Psalms", 150], ["Proverbs", 31], ["Job", 42], ["Song of Songs", 8],
      ["Ruth", 4], ["Lamentations", 5], ["Ecclesiastes", 12], ["Esther", 10],
      ["Daniel", 12], ["Ezra", 10], ["Nehemiah", 13], ["I Chronicles", 29],
      ["II Chronicles", 36]
    ]
  };

  const collectionLabels = {
    siddur: "Siddur",
    mahzor: "Mahzor",
    haggadah: "Haggadah",
    pirkei_avot: "Pirkei Avot",
    torah: "Torah",
    neviim: "Neviim",
    ketuvim: "Ketuvim"
  };

  function normalizeQuery(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z\u0590-\u05ff]+/g, " ")
      .trim();
  }

  function keyForQuery(query) {
    const normalized = normalizeQuery(query);
    const terms = {
      siddur: ["siddur", "siddurim", "סידור", "סידורים"],
      mahzor: ["mahzor", "mahzorim", "machzor", "machzorim", "מחזור", "מחזורים"],
      haggadah: ["haggadah", "haggadot", "hagaddah", "hagadah", "הגדה", "הגדות"],
      pirkei_avot: ["pirkei avot", "pirke avot", "pirkei abot", "פרקי אבות"],
      torah: ["torah", "תורה"],
      neviim: ["neviim", "נביאים"],
      ketuvim: ["ketuvim", "כתובים"]
    };
    return Object.keys(terms).find((key) => terms[key].includes(normalized)) || "";
  }

  function liturgyResults(entries, category) {
    return entries.map((entry) => ({
      ...entry,
      categories: ["Liturgy", category, entry.tradition, entry.coverage],
      source: "catalog"
    }));
  }

  function tanakhResults(key) {
    return (tanakhCollections[key] || []).map(([ref, chapters]) => ({
      ref,
      chapters,
      categories: ["Tanakh", collectionLabels[key]],
      source: "catalog",
      sourceUrl: `https://www.sefaria.org/${ref.replace(/\s+/g, "_")}`,
      valid: true,
      availability: "browse"
    }));
  }

  function resultsForKey(key) {
    if (key === "siddur") return liturgyResults(siddurim, "Siddur");
    if (key === "mahzor") return liturgyResults(mahzorim, "High Holidays");
    if (key === "haggadah") return liturgyResults(haggadot, "Haggadah");
    if (key === "pirkei_avot") {
      return Array.from({ length: 6 }, (_value, index) => ({
        ref: `Pirkei Avot ${index + 1}`,
        displayLabel: String(index + 1),
        categories: ["Mishnah", "Seder Nezikin"],
        source: "chapter",
        sourceUrl: `https://www.sefaria.org/Pirkei_Avot.${index + 1}`,
        valid: true,
        availability: "import-reference"
      }));
    }
    return tanakhResults(key);
  }

  function resultsForQuery(query) {
    return resultsForKey(keyForQuery(query));
  }

  function requiresValidation(key) {
    return ["siddur", "mahzor", "haggadah"].includes(key);
  }

  return {
    collectionLabels,
    haggadot: Object.freeze(haggadot),
    keyForQuery,
    mahzorim: Object.freeze(mahzorim),
    requiresValidation,
    resultsForKey,
    resultsForQuery,
    siddurim: Object.freeze(siddurim),
    tanakhCollections: Object.freeze(tanakhCollections)
  };
});
