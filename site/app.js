(function () {
  const input = document.getElementById("hebrewInput");
  const output = document.getElementById("transliterationOutput");
  const transliterationNotice = document.getElementById("transliterationNotice");
  const styleSelect = document.getElementById("styleSelect");
  const doubleDageshToggle = document.getElementById("doubleDageshToggle");
  const stressMarkToggle = document.getElementById("stressMarkToggle");
  const tzereOverrideRadios = Array.from(document.querySelectorAll("input[name='tzereOverride']"));
  const chetOverride = document.getElementById("chetOverride");
  const khafOverride = document.getElementById("khafOverride");
  const sampleButton = document.getElementById("sampleButton");
  const copyButton = document.getElementById("copyButton");
  const sefariaQuery = document.getElementById("sefariaQuery");
  const sefariaImportButton = document.getElementById("sefariaImportButton");
  const sefariaSearchButton = document.getElementById("sefariaSearchButton");
  const sefariaStatus = document.getElementById("sefariaStatus");
  const sefariaResults = document.getElementById("sefariaResults");

  const usageEventNames = new Set([
    "transliteration_copied",
    "sefaria_search_succeeded",
    "sefaria_search_zero_results",
    "sefaria_search_failed",
    "sefaria_import_succeeded",
    "sefaria_import_failed",
    "style_selected"
  ]);

  function recordUsageEvent(eventName) {
    if (!usageEventNames.has(eventName) || location.protocol === "file:") {
      return;
    }

    const body = JSON.stringify({ schemaVersion: 2, event: eventName });
    try {
      if (navigator.sendBeacon) {
        const queued = navigator.sendBeacon(
          "/api/event",
          new Blob([body], { type: "application/json" })
        );
        if (queued) {
          return;
        }
      }

      fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    } catch {
      // Analytics must never interfere with transliteration.
    }
  }

  const rulesets = window.HebrewRulesets.all || [window.HebrewRulesets.modernSefardi];
  let transliterator = new window.HebrewTransliterator.Transliterator(rulesets[0]);
  let sefariaNavigationStack = [];
  let currentSefariaResults = null;

  const liturgySearchAliases = [
    {
      terms: ["baruch sheamar", "barukh sheamar", "baruch she'amar", "barukh she'amar"],
      refs: [
        "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Barukh She'amar 2",
        "Siddur Ashkenaz, Shabbat, Shacharit, Pesukei Dezimra, Barukh She'amar 1",
        "Siddur Edot HaMizrach, Weekday Shacharit, Pesukei D'Zimra 2"
      ],
      hebrewQuery: "ברוך שאמר"
    },
    {
      terms: ["mi chamocha", "mi khamocha", "mi kamocha", "mi camocha"],
      refs: [
        "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 6",
        "Siddur Ashkenaz, Weekday, Maariv, Blessings of the Shema, First Blessing after Shema 3",
        "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Az Yashir 3",
        "Exodus 15:11"
      ],
      hebrewQuery: "מי כמכה"
    },
    {
      terms: ["shema", "shma", "shema yisrael", "shma yisrael"],
      refs: [
        "Deuteronomy 6:4-9",
        "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 1"
      ],
      hebrewQuery: "שמע ישראל"
    },
    {
      terms: ["veahavta", "v'ahavta", "ve'ahavta", "ahavta"],
      refs: ["Deuteronomy 6:5-9"],
      hebrewQuery: "ואהבת"
    },
    {
      terms: ["oseh shalom", "oseh shalom bimromav"],
      refs: [
        "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Concluding Passage 1",
        "Siddur Ashkenaz, Weekday, Maariv, Amidah, Concluding Passage 1"
      ],
      hebrewQuery: "עושה שלום"
    }
  ];

  const sampleText = "בָּרוּךְ שֶׁאָמַר וְהָיָה הָעוֹלָם, בָּרוּךְ הוּא, בָּרוּךְ עֹשֶׂה בְרֵאשִׁית, בָּרוּךְ אוֹמֵר וְעוֹשֶׂה, בָּרוּךְ גּוֹזֵר וּמְקַיֵּם, בָּרוּךְ מְרַחֵם עַל הָאָֽרֶץ, בָּרוּךְ מְרַחֵם עַל הַבְּרִיּוֹת, בָּרוּךְ מְשַׁלֵּם שָׂכָר טוֹב לִירֵאָיו, בָּרוּךְ חַי לָעַד וְקַיָּם לָנֶֽצַח, בָּרוּךְ פּוֹדֶה וּמַצִּיל, בָּרוּךְ שְׁמוֹ: בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵֽינוּ מֶֽלֶךְ הָעוֹלָם הָאֵל הָאָב הָרַחֲמָן הַמְּהֻלָּל בְּפִי עַמּוֹ מְשֻׁבָּח וּמְפֹאָר בִּלְשׁוֹן חֲסִידָיו וַעֲבָדָיו וּבְשִׁירֵי דָוִד עַבְדֶּֽךָ, נְהַלֶּלְךָ יְהֹוָה אֱלֹהֵֽינוּ בִּשְׁבָחוֹת וּבִזְמִירוֹת נְגַדֶּלְךָ וּנְשַׁבֵּחֲךָ וּנְפָאֶרְךָ וְנַזְכִּיר שִׁמְךָ וְנַמְלִיכְךָ מַלְכֵּֽנוּ אֱלֹהֵֽינוּ, יָחִיד, חֵי הָעוֹלָמִים, מֶֽלֶךְ מְשֻׁבָּח וּמְפֹאָר עֲדֵי עַד שְׁמוֹ הַגָּדוֹל: בָּרוּךְ אַתָּה יְהֹוָה מֶֽלֶךְ מְהֻלָּל בַּתִּשְׁבָּחוֹת:";
  const sefariaIndexCache = new Map();

  function updateOutput() {
    if (stressMarkToggle?.checked) {
      output.textContent = transliterator.transliterateWithStressMarks(input.value);
    } else {
      output.textContent = transliterator.transliterate(input.value);
    }
    updateTransliterationNotice();
  }

  function updateTransliterationNotice() {
    if (!transliterationNotice) {
      return;
    }

    const unvocalizedWords = transliterator.unvocalizedWords(input.value);
    if (!unvocalizedWords.length) {
      transliterationNotice.textContent = "";
      transliterationNotice.hidden = true;
      return;
    }

    const uniqueWords = Array.from(new Set(unvocalizedWords));
    const preview = uniqueWords.slice(0, 4).join(", ");
    const more = uniqueWords.length > 4 ? `, and ${uniqueWords.length - 4} more` : "";
    transliterationNotice.hidden = false;
    transliterationNotice.textContent = `Some Hebrew words have no vowels and were left unchanged: ${preview}${more}.`;
  }

  function populateStyleSelect() {
    for (const ruleset of rulesets) {
      const option = document.createElement("option");
      option.value = ruleset.id;
      option.textContent = ruleset.name;
      styleSelect.appendChild(option);
    }
  }

  function cloneRuleset(ruleset) {
    return JSON.parse(JSON.stringify(ruleset));
  }

  function capitalizeFirst(value) {
    return value ? value[0].toUpperCase() + value.slice(1) : value;
  }

  function replaceLiteral(value, from, to) {
    return from && from !== to ? value.split(from).join(to) : value;
  }

  function replaceStyleSound(value, from, to) {
    return replaceLiteral(
      replaceLiteral(value, capitalizeFirst(from), capitalizeFirst(to)),
      from,
      to
    );
  }

  function remapExceptionTable(table, mapper) {
    return Object.fromEntries(
      Object.entries(table || {}).map(([key, value]) => [key, mapper(value)])
    );
  }

  function remapStyleSensitiveExceptions(ruleset, selectedRuleset, chetValue, khafValue) {
    const baseChet = selectedRuleset.consonants?.["ח"];
    const baseKhaf = selectedRuleset.consonants?.["כ"]?.plain;

    const mapper = (value) => {
      let next = value;
      next = replaceStyleSound(next, baseKhaf, khafValue);
      if (baseChet !== baseKhaf) {
        next = replaceStyleSound(next, baseChet, chetValue);
      }
      return next;
    };

    ruleset.exceptions = {
      ...(ruleset.exceptions || {}),
      exactWords: remapExceptionTable(ruleset.exceptions?.exactWords, mapper),
      niqqudless: remapExceptionTable(ruleset.exceptions?.niqqudless, mapper),
      phraseCapitalization: remapExceptionTable(ruleset.exceptions?.phraseCapitalization, mapper)
    };
  }

  function currentRuleset() {
    const selectedRuleset = rulesets.find((candidate) => candidate.id === styleSelect.value) || rulesets[0];
    const ruleset = cloneRuleset(selectedRuleset);
    const tzereOverride = tzereOverrideRadios.find((radio) => radio.checked)?.value || ruleset.vowels.tzere;
    const chetValue = chetOverride?.value || ruleset.consonants["ח"];
    const khafValue = khafOverride?.value || ruleset.consonants["כ"]?.plain;
    ruleset.vowels = {
      ...(ruleset.vowels || {}),
      tzere: tzereOverride
    };
    ruleset.consonants = {
      ...(ruleset.consonants || {}),
      "ח": chetValue,
      "כ": {
        ...(ruleset.consonants["כ"] || {}),
        plain: khafValue
      },
      "ך": {
        ...(ruleset.consonants["ך"] || {}),
        plain: khafValue
      }
    };
    remapStyleSensitiveExceptions(ruleset, selectedRuleset, chetValue, khafValue);
    ruleset.output = {
      ...(ruleset.output || {}),
      doubleDageshChazak: Boolean(doubleDageshToggle?.checked)
    };
    return ruleset;
  }

  function refreshTransliterator() {
    transliterator = new window.HebrewTransliterator.Transliterator(currentRuleset());
    updateOutput();
  }

  function setStyle(rulesetId) {
    styleSelect.value = rulesetId;
    syncTzereOverrideToStyle();
    syncConsonantOverridesToStyle();
    refreshTransliterator();
  }

  function setOptions() {
    refreshTransliterator();
  }

  function syncTzereOverrideToStyle() {
    const selectedRuleset = rulesets.find((candidate) => candidate.id === styleSelect.value) || rulesets[0];
    const tzereValue = selectedRuleset.vowels?.tzere || "e";
    for (const radio of tzereOverrideRadios) {
      radio.checked = radio.value === tzereValue;
    }
  }

  function syncConsonantOverridesToStyle() {
    const selectedRuleset = rulesets.find((candidate) => candidate.id === styleSelect.value) || rulesets[0];
    if (chetOverride) {
      chetOverride.value = selectedRuleset.consonants?.["ח"] || "ḥ";
    }
    if (khafOverride) {
      khafOverride.value = selectedRuleset.consonants?.["כ"]?.plain || "kh";
    }
  }

  function setSefariaStatus(message) {
    sefariaStatus.textContent = message;
  }

  function setSefariaBusy(isBusy) {
    sefariaImportButton.disabled = isBusy;
    sefariaSearchButton.disabled = isBusy;
  }

  function normalizeSearchTerm(value) {
    return value
      .toLowerCase()
      .replace(/[׳'’`]/g, "")
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
      .trim();
  }

  function liturgyAliasesFor(query) {
    const normalized = normalizeSearchTerm(query);
    return liturgySearchAliases.filter((alias) =>
      alias.terms.some((term) => normalizeSearchTerm(term) === normalized)
    );
  }

  function looksLikeExactRef(query) {
    const trimmed = query.trim();
    return (
      /\d/.test(trimmed) ||
      /[:,-]/.test(trimmed) ||
      /\b(?:genesis|exodus|leviticus|numbers|deuteronomy|deut|psalms?|tehillim|isaiah|jeremiah|ezekiel|samuel|kings|chronicles|job|proverbs|mishlei|ruth|esther|daniel|ezra|nehemiah|micah|jonah|amos|hosea|zechariah|malachi)\b/i.test(trimmed)
    );
  }

  function stripHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = value;
    return template.content.textContent || template.innerText || "";
  }

  function flattenText(value) {
    if (Array.isArray(value)) {
      return value.map(flattenText).filter(Boolean).join("\n");
    }

    if (typeof value === "string") {
      return stripHtml(value).trim();
    }

    return "";
  }

  function extractTextFromV3(data) {
    const versions = Array.isArray(data.versions) ? data.versions : [];

    for (const version of versions) {
      const text = flattenText(version.text || version.content || version.body);
      if (text) {
        return text;
      }
    }

    return flattenText(data.text || data.content || data.he);
  }

  function extractTextFromV1(data) {
    return flattenText(data.he || data.text);
  }

  function sefariaErrorMessage(error) {
    if (location.protocol === "file:") {
      return "Sefaria could not be reached from this file page. If this keeps happening, run the page from localhost and try again.";
    }

    return error.message || "Sefaria could not be reached.";
  }

  function noHebrewTextError(reference) {
    return new Error(`No Hebrew text was found for ${reference}. Sefaria may list this as an empty section.`);
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = new Error(`Sefaria returned ${response.status}`);
      error.status = response.status;
      try {
        error.body = await response.text();
      } catch {
        error.body = "";
      }
      throw error;
    }
    return response.json();
  }

  function isSchemaNodeError(error) {
    return error?.status === 400 && /schema node ref/i.test(error.body || error.message || "");
  }

  function splitRefPath(reference) {
    return reference.split(",").map((part) => part.trim()).filter(Boolean);
  }

  function normalizeRefPart(value) {
    return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function nodeNames(node) {
    const names = [node.key, node.title].filter(Boolean);
    for (const title of node.titles || []) {
      if (title.lang === "en" && title.text) {
        names.push(title.text);
      }
    }
    return names;
  }

  function nodeMatches(node, refPart) {
    const normalizedPart = normalizeRefPart(refPart);
    return nodeNames(node).some((name) => normalizeRefPart(name) === normalizedPart);
  }

  function childNodes(node) {
    return Array.isArray(node?.nodes) ? node.nodes : [];
  }

  function findSchemaNode(node, pathParts, index = 0) {
    if (!node || index >= pathParts.length) {
      return node;
    }

    if (nodeMatches(node, pathParts[index])) {
      return findSchemaNode(node, pathParts, index + 1);
    }

    for (const child of childNodes(node)) {
      if (nodeMatches(child, pathParts[index])) {
        return findSchemaNode(child, pathParts, index + 1);
      }
    }

    return null;
  }

  function appendRefPart(parts, part) {
    if (!part || normalizeRefPart(parts[parts.length - 1]) === normalizeRefPart(part)) {
      return parts;
    }
    return [...parts, part];
  }

  function primaryNodeName(node) {
    return node.key || node.title || nodeNames(node)[0] || "";
  }

  function collectLeafRefs(node, pathParts) {
    const children = childNodes(node);
    if (!children.length) {
      if (node?.nodeType !== "JaggedArrayNode") {
        return [];
      }
      const ref = pathParts.join(", ");
      return node.depth === 1 ? [`${ref} 1`] : [ref];
    }

    return children.flatMap((child) =>
      collectLeafRefs(child, appendRefPart(pathParts, primaryNodeName(child)))
    );
  }

  async function fetchSefariaIndex(title) {
    const normalizedTitle = title.trim();
    if (!sefariaIndexCache.has(normalizedTitle)) {
      const indexUrl = `https://www.sefaria.org/api/index/${encodeURIComponent(normalizedTitle)}`;
      sefariaIndexCache.set(normalizedTitle, fetchJson(indexUrl));
    }
    return sefariaIndexCache.get(normalizedTitle);
  }

  async function expandSchemaRef(reference) {
    const pathParts = splitRefPath(reference);
    if (!pathParts.length) {
      return [];
    }

    const indexData = await fetchSefariaIndex(pathParts[0]);
    const schemaNode = findSchemaNode(indexData.schema, pathParts);
    if (!schemaNode) {
      return [];
    }

    return collectLeafRefs(schemaNode, pathParts).slice(0, 60);
  }

  async function fetchExpandedSchemaRef(reference) {
    const leafRefs = await expandSchemaRef(reference);
    const childTexts = [];
    for (const leafRef of leafRefs) {
      try {
        const text = await fetchSefariaLeafTextWithSegmentFallback(leafRef);
        if (text) {
          childTexts.push(text);
        }
      } catch {
        // Some schema leaves are not text-bearing in older Sefaria endpoints.
      }
    }
    return childTexts.join("\n\n");
  }

  async function fetchSefariaLeafText(reference) {
    const encodedRef = encodeURIComponent(reference.trim());
    const v1Url = `https://www.sefaria.org/api/texts/${encodedRef}?context=0&commentary=0`;
    const v3Url = `https://www.sefaria.org/api/v3/texts/${encodedRef}?version=source&return_format=text_only`;
    const preferLegacy = /^(Siddur|Machzor|Haggadah)\b/i.test(reference.trim());
    let v3Error = null;
    let v1Error = null;

    if (preferLegacy) {
      try {
        const data = await fetchJson(v1Url);
        const text = extractTextFromV1(data);
        if (text) {
          return text;
        }
        throw noHebrewTextError(reference);
      } catch (error) {
        v1Error = error;
        if (!/No Hebrew text/.test(error.message || "")) {
          throw error;
        }
      }
    } else {
      try {
        const data = await fetchJson(v3Url);
        const text = extractTextFromV3(data);
        if (text) {
          return text;
        }
      } catch (error) {
        v3Error = error;
      }
    }

    try {
      const data = await fetchJson(v1Url);
      const text = extractTextFromV1(data);
      if (!text) {
        throw noHebrewTextError(reference);
      }
      return text;
    } catch (error) {
      if (isSchemaNodeError(v3Error) || isSchemaNodeError(error)) {
        throw error || v3Error;
      }
      if (v3Error?.status === 400 || error?.status === 400) {
        throw new Error("Sefaria found that title, but it is not an importable source text. Try a Tanakh reference or a Siddur, Machzor, or Haggadah section.");
      }
      throw error || v1Error || v3Error || new Error("Sefaria could not load that reference.");
    }
  }

  async function fetchSefariaLeafTextWithSegmentFallback(reference) {
    try {
      return await fetchSefariaLeafText(reference);
    } catch (error) {
      if (!/\d$/.test(reference.trim())) {
        try {
          return await fetchSefariaLeafText(`${reference} 1`);
        } catch {
          // Keep the original, more relevant error.
        }
      }
      throw error;
    }
  }

  async function fetchSefariaText(reference) {
    try {
      return await fetchSefariaLeafTextWithSegmentFallback(reference);
    } catch (error) {
      if (isSchemaNodeError(error)) {
        const text = await fetchExpandedSchemaRef(reference);
        if (text) {
          return text;
        }
      }
      throw error;
    }
  }

  function insertImportedText(text) {
    input.value = text;
    updateOutput();
    input.setSelectionRange(0, 0);
    input.scrollTop = 0;
    input.focus();
    window.requestAnimationFrame(() => {
      input.setSelectionRange(0, 0);
      input.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0 });
    });
  }

  async function importSefariaReference(reference) {
    const trimmed = reference.trim();
    if (!trimmed) {
      setSefariaStatus("Enter a Sefaria reference or search term.");
      return;
    }

    setSefariaBusy(true);
    setSefariaStatus(`Importing ${trimmed}...`);

    try {
      const text = await fetchSefariaText(trimmed);
      insertImportedText(text);
      setSefariaStatus(`Imported ${trimmed}.`);
      recordUsageEvent("sefaria_import_succeeded");
    } catch (error) {
      setSefariaStatus(sefariaErrorMessage(error));
      recordUsageEvent("sefaria_import_failed");
    } finally {
      setSefariaBusy(false);
    }
  }

  function getSearchHitRef(hit) {
    const source = hit._source || hit.source || hit;
    return source.ref || source.heRef || source.tref || hit.ref || hit.heRef || "";
  }

  function getSearchHitCategories(hit) {
    const source = hit._source || hit.source || hit;
    return source.categories || source.path || hit.categories || [];
  }

  function extractSearchHits(data) {
    if (Array.isArray(data.results)) {
      return data.results;
    }

    if (Array.isArray(data.hits)) {
      return data.hits;
    }

    if (Array.isArray(data.hits?.hits)) {
      return data.hits.hits;
    }

    return [];
  }

  function getNameResultRef(item) {
    if (typeof item === "string") {
      return item;
    }

    if (Array.isArray(item)) {
      return item.find((part) => typeof part === "string") || "";
    }

    if (item && typeof item === "object") {
      return item.ref || item.key || item.title || item.name || item.en || item.he || "";
    }

    return "";
  }

  function extractNameResults(data) {
    if (Array.isArray(data)) {
      return data.map(getNameResultRef).filter(Boolean);
    }

    for (const key of ["completion_objects", "completions", "results", "items"]) {
      if (Array.isArray(data?.[key])) {
        return data[key].map(getNameResultRef).filter(Boolean);
      }
    }

    return [];
  }

  function resultFromRef(ref, categories = [], source = "search", meta = {}) {
    return { ref, categories, source, ...meta };
  }

  function isTanakhRef(ref) {
    return /^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|I Samuel|II Samuel|I Kings|II Kings|Isaiah|Jeremiah|Ezekiel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Psalms|Proverbs|Job|Song of Songs|Ruth|Lamentations|Ecclesiastes|Esther|Daniel|Ezra|Nehemiah|I Chronicles|II Chronicles)\b/i.test(ref);
  }

  function isLiturgyRef(ref, categories = []) {
    return /Liturgy|Siddur|Machzor|Haggadah/i.test(`${categories.join(" ")} ${ref}`);
  }

  function isCommentaryRef(ref, categories = []) {
    return /\bon\b/i.test(ref) || /Commentary/i.test(categories.join(" "));
  }

  function isImportableSearchResult(result) {
    const ref = typeof result === "string" ? result : result.ref;
    const categories = typeof result === "string" ? [] : result.categories || [];
    const source = typeof result === "string" ? "search" : result.source;

    if (!ref) {
      return false;
    }

    if (source === "alias" || source === "schema" || source === "schemaLeaf") {
      return true;
    }

    if (isCommentaryRef(ref, categories)) {
      return false;
    }

    return isTanakhRef(ref) || isLiturgyRef(ref, categories);
  }

  function relevantRank(result) {
    const ref = result.ref || "";

    if (isTanakhRef(ref)) {
      return 0;
    }
    if (isLiturgyRef(ref, result.categories || [])) {
      return 1;
    }
    return 2;
  }

  function sortRelevantResults(results) {
    return [...results].sort((a, b) => relevantRank(a) - relevantRank(b));
  }

  function shortRefLabel(ref) {
    const parts = splitRefPath(ref);
    return parts[parts.length - 1] || ref;
  }

  async function schemaChildResults(reference) {
    const pathParts = splitRefPath(reference);
    if (!pathParts.length) {
      return [];
    }

    const indexData = await fetchSefariaIndex(pathParts[0]);
    const schemaNode = findSchemaNode(indexData.schema, pathParts);
    const children = childNodes(schemaNode);
    return children.map((child) => {
      const childRef = appendRefPart(pathParts, primaryNodeName(child)).join(", ");
      const hasChildren = childNodes(child).length > 0;
      return resultFromRef(
        childRef,
        indexData.categories || [],
        hasChildren ? "schema" : "schemaLeaf",
        { hasChildren }
      );
    });
  }

  async function openSefariaResult(reference) {
    const trimmed = reference.trim();
    if (!trimmed) {
      return;
    }

    setSefariaBusy(true);
    setSefariaStatus(`Opening ${trimmed}...`);

    try {
      const childResults = await schemaChildResults(trimmed);
      if (childResults.length) {
        if (currentSefariaResults) {
          sefariaNavigationStack.push(currentSefariaResults);
        }
        renderRefResults(childResults, { parentRef: trimmed });
        return;
      }
    } catch {
      // If a ref has no index schema, treat it as a normal importable ref.
    } finally {
      setSefariaBusy(false);
    }

    importSefariaReference(trimmed);
  }

  function handleSefariaResultClick(result) {
    if (result.hasChildren === false || result.source === "schemaLeaf") {
      importSefariaReference(result.ref);
      return;
    }

    openSefariaResult(result.ref);
  }

  function goBackSefariaResults() {
    const previous = sefariaNavigationStack.pop();
    if (previous) {
      renderRefResults(previous.results, previous.options, { preserveStack: true });
    }
  }

  function renderSefariaNavigation(options) {
    if (!options.parentRef && !sefariaNavigationStack.length) {
      return;
    }

    const nav = document.createElement("div");
    nav.className = "sefaria-navigation";

    if (sefariaNavigationStack.length) {
      const backButton = document.createElement("button");
      backButton.className = "result-button back-button";
      backButton.type = "button";
      backButton.textContent = "Back";
      backButton.addEventListener("click", goBackSefariaResults);
      nav.appendChild(backButton);
    }

    if (options.parentRef) {
      const trail = document.createElement("span");
      trail.className = "sefaria-breadcrumb";
      trail.textContent = splitRefPath(options.parentRef).map(shortRefLabel).join(" / ");
      nav.appendChild(trail);
    }

    sefariaResults.appendChild(nav);
  }

  function renderRefResults(results, options = {}, renderOptions = {}) {
    sefariaResults.textContent = "";
    if (!renderOptions.preserveStack && !options.parentRef) {
      sefariaNavigationStack = [];
    }
    currentSefariaResults = { results, options };
    renderSefariaNavigation(options);

    const uniqueResults = [];
    const seenRefs = new Set();
    const sortedResults = sortRelevantResults(results);
    const importableResults = sortedResults.filter(isImportableSearchResult);
    for (const result of importableResults) {
      const ref = typeof result === "string" ? result : result.ref;
      if (ref) {
        if (!seenRefs.has(ref)) {
          uniqueResults.push(typeof result === "string" ? resultFromRef(ref) : result);
          seenRefs.add(ref);
        }
      }
      if (uniqueResults.length >= 10) {
        break;
      }
    }

    if (!uniqueResults.length) {
      const hiddenCount = sortedResults.length - importableResults.length;
      const hiddenText = hiddenCount > 0 ? " Some Sefaria hits were hidden because they appear to be commentaries or non-liturgy texts." : "";
      setSefariaStatus(`No importable Tanakh or liturgy results found. Try a prayer name, or Import an exact reference like Genesis 1:1.${hiddenText}`);
      return 0;
    }

    for (const result of uniqueResults) {
      const button = document.createElement("button");
      button.className = result.hasChildren ? "result-button folder-button" : "result-button";
      button.type = "button";
      const suffix = result.source === "alias" ? " · suggested" : result.hasChildren ? " ›" : "";
      const label = options.parentRef ? shortRefLabel(result.ref) : result.ref;
      button.textContent = `${label}${suffix}`;
      button.addEventListener("click", () => {
        handleSefariaResultClick(result);
      });
      sefariaResults.appendChild(button);
    }

    if (options.parentRef) {
      setSefariaStatus(`Showing ${uniqueResults.length} section${uniqueResults.length === 1 ? "" : "s"}. Click a section to open it or import it.`);
    } else {
      setSefariaStatus(`Found ${uniqueResults.length} result${uniqueResults.length === 1 ? "" : "s"}. Click a result to open it or import it.`);
    }

    return uniqueResults.length;
  }

  function renderSefariaResults(hits) {
    renderRefResults(hits.map((hit) => resultFromRef(getSearchHitRef(hit), getSearchHitCategories(hit))));
  }

  async function searchWrapper(query, size = 12) {
    const data = await fetchJson("https://www.sefaria.org/api/search-wrapper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        type: "text",
        field: "naive_lemmatizer",
        size,
        source_proj: true
      })
    });

    return extractSearchHits(data).map((hit) => resultFromRef(getSearchHitRef(hit), getSearchHitCategories(hit)));
  }

  async function nameSearch(query) {
    const nameUrl = `https://www.sefaria.org/api/name/${encodeURIComponent(query)}?limit=12&type=ref`;
    const nameData = await fetchJson(nameUrl);
    return extractNameResults(nameData).map((ref) => resultFromRef(ref, [], "name"));
  }

  async function searchSefaria(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      setSefariaStatus("Enter a prayer name, phrase, or exact reference.");
      return;
    }

    setSefariaBusy(true);
    setSefariaStatus(`Searching Sefaria for ${trimmed}...`);
    sefariaResults.textContent = "";
    sefariaNavigationStack = [];
    currentSefariaResults = null;

    try {
      const aliasMatches = liturgyAliasesFor(trimmed);
      const aliasResults = aliasMatches.flatMap((alias) =>
        alias.refs.map((ref) => resultFromRef(ref, ["Liturgy"], "alias"))
      );
      let displayedResultCount = 0;
      if (aliasResults.length) {
        displayedResultCount = renderRefResults(aliasResults);
      }

      const queryTerms = [
        trimmed,
        ...aliasMatches.map((alias) => alias.hebrewQuery).filter(Boolean)
      ];

      const searches = [
        nameSearch(trimmed),
        ...queryTerms.map((term) => searchWrapper(term))
      ];
      const settledSearches = await Promise.allSettled(searches);
      const searchErrors = settledSearches.filter((result) => result.status === "rejected");
      const remoteResults = settledSearches.flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
      );

      if (!aliasResults.length && !remoteResults.length && searchErrors.length) {
        throw searchErrors[0].reason;
      }

      if (remoteResults.length || !aliasResults.length) {
        displayedResultCount = renderRefResults([
          ...aliasResults,
          ...remoteResults
        ]);
      }
      recordUsageEvent(displayedResultCount > 0 ? "sefaria_search_succeeded" : "sefaria_search_zero_results");
    } catch (error) {
      setSefariaStatus(sefariaErrorMessage(error));
      recordUsageEvent("sefaria_search_failed");
    } finally {
      setSefariaBusy(false);
    }
  }

  function importOrSearchSefaria(query) {
    if (looksLikeExactRef(query)) {
      importSefariaReference(query);
    } else {
      searchSefaria(query);
    }
  }

  input.addEventListener("input", updateOutput);

  styleSelect.addEventListener("change", () => {
    setStyle(styleSelect.value);
    recordUsageEvent("style_selected");
  });

  doubleDageshToggle?.addEventListener("change", setOptions);
  stressMarkToggle?.addEventListener("change", updateOutput);
  for (const radio of tzereOverrideRadios) {
    radio.addEventListener("change", setOptions);
  }
  chetOverride?.addEventListener("change", setOptions);
  khafOverride?.addEventListener("change", setOptions);

  sampleButton.addEventListener("click", () => {
    input.value = sampleText;
    updateOutput();
    input.focus();
  });

  sefariaImportButton.addEventListener("click", () => {
    importOrSearchSefaria(sefariaQuery.value);
  });

  sefariaSearchButton.addEventListener("click", () => {
    searchSefaria(sefariaQuery.value);
  });

  sefariaQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchSefaria(sefariaQuery.value);
    }
  });

  copyButton.addEventListener("click", async () => {
    const text = output.textContent;
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1200);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(output);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    recordUsageEvent("transliteration_copied");
  });

  populateStyleSelect();
  syncTzereOverrideToStyle();
  syncConsonantOverridesToStyle();
  refreshTransliterator();
})();
