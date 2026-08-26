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
  const sefariaCancelButton = document.getElementById("sefariaCancelButton");
  const verboseResultsToggle = document.getElementById("verboseResultsToggle");
  const sefariaStatus = document.getElementById("sefariaStatus");
  const sefariaImportSource = document.getElementById("sefariaImportSource");
  const sefariaResults = document.getElementById("sefariaResults");
  const sefariaResultTools = window.HebrewTransliteratorSefaria;
  const sefariaCatalog = window.HebrewTransliteratorSefariaCatalog;
  const sefariaClient = new window.HebrewTransliteratorSefariaClient.SefariaClient({ timeoutMs: 9000 });

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

  function normalizedSefariaSearchTerm(value) {
    return String(value || "")
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 100);
  }

  function looksLikeSensitiveSearchTerm(value) {
    return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
      /\bhttps?:\/\/|\bwww\./i.test(value) ||
      /(?:\+?\d[\s().-]*){7,}/.test(value);
  }

  function recordSefariaSearch(searchTerm, status, resultCount = 0) {
    const normalizedTerm = normalizedSefariaSearchTerm(searchTerm);
    if (!normalizedTerm || typeof window.zaraz?.track !== "function") {
      return;
    }

    const redacted = looksLikeSensitiveSearchTerm(normalizedTerm);
    try {
      void window.zaraz.track("search", {
        search_term: redacted ? "[redacted]" : normalizedTerm,
        search_status: status,
        result_count: Math.max(0, Number(resultCount) || 0),
        search_mode: "sefaria_name_or_phrase",
        search_term_redacted: redacted ? "yes" : "no"
      });
    } catch {
      // Analytics must never interfere with Sefaria search.
    }
  }

  const rulesets = window.HebrewRulesets.all || [window.HebrewRulesets.modernSefardi];
  let transliterator = new window.HebrewTransliterator.Transliterator(rulesets[0]);
  let sefariaNavigationStack = [];
  let currentSefariaResults = null;
  let activeSefariaController = null;

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
    sefariaCancelButton.hidden = !isBusy;
  }

  function beginSefariaRequest() {
    activeSefariaController?.abort();
    activeSefariaController = new AbortController();
    setSefariaBusy(true);
    return activeSefariaController;
  }

  function finishSefariaRequest(controller) {
    if (activeSefariaController === controller) {
      activeSefariaController = null;
      setSefariaBusy(false);
    }
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

  function sefariaErrorMessage(error) {
    if (location.protocol === "file:") {
      return "Sefaria could not be reached from this file page. If this keeps happening, run the page from localhost and try again.";
    }
    if (navigator.onLine === false) {
      return "You appear to be offline. Transliteration still works with pasted Hebrew, but Sefaria search requires an internet connection.";
    }
    if (error?.code === "cancelled") {
      return "Sefaria request cancelled.";
    }
    if (error?.code === "timeout") {
      return "Sefaria took too long to respond. Please try again.";
    }
    if (error?.code === "no_text") {
      return error.message;
    }
    if (error?.status === 429) {
      return "Sefaria is receiving too many requests right now. Please wait briefly and try again.";
    }
    return error?.message || "Sefaria could not be reached. You can still paste Hebrew directly into the editor.";
  }

  async function fetchJson(url, options) {
    return sefariaClient.requestJson(url, options);
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

  async function fetchSefariaIndex(title, signal) {
    const normalizedTitle = title.trim();
    const indexUrl = `https://www.sefaria.org/api/index/${encodeURIComponent(normalizedTitle)}`;
    return fetchJson(indexUrl, { signal });
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

  function renderImportedSource(result) {
    sefariaImportSource.textContent = "";
    if (!result) {
      return;
    }
    const details = [result.ref, result.versionTitle, result.license].filter(Boolean).join(" · ");
    if (details) {
      sefariaImportSource.append(document.createTextNode(`${details} · `));
    }
    const link = document.createElement("a");
    link.href = result.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on Sefaria";
    sefariaImportSource.appendChild(link);
    const versionSource = safeExternalUrl(result.versionSource);
    if (versionSource) {
      sefariaImportSource.append(document.createTextNode(" · "));
      const versionLink = document.createElement("a");
      versionLink.href = versionSource;
      versionLink.target = "_blank";
      versionLink.rel = "noopener noreferrer";
      versionLink.textContent = "Version source";
      sefariaImportSource.appendChild(versionLink);
    }
  }

  async function importSefariaReference(reference, preparedResult = null) {
    const trimmed = reference.trim();
    if (!trimmed) {
      setSefariaStatus("Enter a Sefaria reference or search term.");
      return;
    }

    const controller = beginSefariaRequest();
    setSefariaStatus(`Importing ${trimmed}...`);
    sefariaImportSource.textContent = "";

    try {
      let result = preparedResult;
      if (!result?.text) {
        const referenceInfo = await sefariaClient.inspectReference(trimmed, { signal: controller.signal });
        if (!referenceInfo.valid) {
          throw new window.HebrewTransliteratorSefariaClient.SefariaRequestError(
            `Sefaria does not recognize “${trimmed}” as a text reference.`,
            "invalid_ref"
          );
        }
        if (referenceInfo.kind === "folder") {
          setSefariaStatus("That reference is a collection of sections. Use Search to browse it, or enter a more specific reference.");
          renderImportedSource(referenceInfo);
          return;
        }
        const payload = await sefariaClient.loadText(referenceInfo.ref, { signal: controller.signal });
        result = {
          ...referenceInfo,
          ...payload,
          sourceUrl: referenceInfo.sourceUrl,
          quality: window.HebrewTransliteratorSefariaClient.textQuality(payload.text)
        };
      }
      insertImportedText(result.text);
      const warning = result.quality?.status === "unvocalized"
        ? " The source contains no vowel points, so transliteration will be limited."
        : result.quality?.status === "partial"
          ? " Some of the source appears only partially vocalized."
          : "";
      setSefariaStatus(`Imported ${result.ref || trimmed}.${warning}`);
      renderImportedSource(result);
      recordUsageEvent("sefaria_import_succeeded");
    } catch (error) {
      setSefariaStatus(sefariaErrorMessage(error));
      if (error?.code !== "cancelled") {
        recordUsageEvent("sefaria_import_failed");
      }
    } finally {
      finishSefariaRequest(controller);
    }
  }

  function getSearchHitRef(hit) {
    const source = hit._source || hit.source || hit;
    return source.ref || source.heRef || source.tref || hit.ref || hit.heRef || "";
  }

  function getSearchHitCategories(hit) {
    const source = hit._source || hit.source || hit;
    const categories = source.categories || source.path || hit.categories || [];
    if (Array.isArray(categories)) {
      return categories;
    }
    return String(categories).split(/[>/]/).map((category) => category.trim()).filter(Boolean);
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
    const normalizedCategories = Array.isArray(categories)
      ? categories
      : String(categories).split(/[>/]/).map((category) => category.trim()).filter(Boolean);
    return { ref, categories: normalizedCategories, source, ...meta };
  }

  function safeExternalUrl(value) {
    if (!value) {
      return "";
    }
    try {
      const url = new URL(value, "https://www.sefaria.org");
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function shortRefLabel(ref) {
    const parts = splitRefPath(ref);
    return parts[parts.length - 1] || ref;
  }

  async function validateSefariaResults(results, query, signal) {
    const candidates = sefariaResultTools.prepareResults(results, query || "", 12);
    const validated = new Array(candidates.length);
    let cursor = 0;

    async function worker() {
      while (cursor < candidates.length) {
        const index = cursor;
        cursor += 1;
        try {
          validated[index] = await sefariaClient.validateResult(candidates[index], { signal });
        } catch (error) {
          if (error?.code === "cancelled") {
            throw error;
          }
          validated[index] = { error, ref: candidates[index].ref };
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, worker));
    const usable = validated.filter((result) => result && !result.error && result.valid !== false);
    return {
      results: usable.slice(0, 10),
      failedCount: validated.length - usable.length,
      candidateCount: candidates.length
    };
  }

  async function schemaChildResults(reference, signal) {
    const pathParts = splitRefPath(reference);
    if (!pathParts.length) {
      return [];
    }

    const indexData = await fetchSefariaIndex(pathParts[0], signal);
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

  async function openSefariaResult(result) {
    const trimmed = result.ref.trim();
    if (!trimmed) {
      return;
    }

    const controller = beginSefariaRequest();
    setSefariaStatus(`Opening ${trimmed}...`);

    try {
      const childResults = await schemaChildResults(trimmed, controller.signal);
      if (childResults.length) {
        setSefariaStatus(`Checking sections in ${trimmed}...`);
        const validated = await validateSefariaResults(childResults, "", controller.signal);
        if (currentSefariaResults) {
          sefariaNavigationStack.push(currentSefariaResults);
        }
        renderRefResults(validated.results, {
          parentRef: trimmed,
          alreadyValidated: true,
          failedCount: validated.failedCount
        });
        return;
      }
      setSefariaStatus("This is a collection rather than a directly importable text. Use “View on Sefaria” to browse all of its sections.");
      renderImportedSource(result);
    } catch (error) {
      setSefariaStatus(sefariaErrorMessage(error));
    } finally {
      finishSefariaRequest(controller);
    }
  }

  function handleSefariaResultClick(result) {
    if (result.availability === "import" && result.text) {
      importSefariaReference(result.ref, result);
      return;
    }
    if (result.availability === "browse") {
      openSefariaResult(result);
    }
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
    const verboseResults = verboseResultsToggle.checked;
    sefariaResults.classList.toggle("verbose-results", verboseResults);
    if (!renderOptions.preserveStack && !options.parentRef) {
      sefariaNavigationStack = [];
    }
    currentSefariaResults = { results, options };
    renderSefariaNavigation(options);

    const uniqueResults = options.alreadyValidated
      ? results.slice(0, 10)
      : sefariaResultTools.prepareResults(results, options.query || "", 10);

    if (!uniqueResults.length) {
      const checkedText = options.failedCount
        ? " Sefaria returned possible matches, but none could be verified as usable Hebrew texts."
        : "";
      const partialText = options.partialMessage ? ` ${options.partialMessage}` : "";
      setSefariaStatus(`No importable Tanakh or liturgy results found. Try a prayer name, or Import an exact reference like Genesis 1:1.${checkedText}${partialText}`);
      return 0;
    }

    for (const result of uniqueResults) {
      const label = options.parentRef ? shortRefLabel(result.ref) : result.ref;

      if (!verboseResults) {
        const button = document.createElement("button");
        button.className = result.availability === "browse"
          ? "result-button folder-button"
          : "result-button";
        button.type = "button";
        button.textContent = label;

        if (result.availability === "unavailable") {
          button.disabled = true;
          button.title = "This Hebrew text is not sufficiently vocalized for automatic transliteration.";
        } else {
          const action = result.availability === "browse" ? "Browse sections in" : "Import";
          button.setAttribute("aria-label", `${action} ${result.ref}`);
          button.addEventListener("click", () => handleSefariaResultClick(result));
        }

        sefariaResults.appendChild(button);
        continue;
      }

      const card = document.createElement("article");
      card.className = "result-card";

      const title = document.createElement("h3");
      title.className = "result-card-title";
      title.textContent = result.source === "alias" ? `${label} · suggested` : label;
      card.appendChild(title);

      if (result.heRef) {
        const hebrewTitle = document.createElement("p");
        hebrewTitle.className = "result-card-hebrew";
        hebrewTitle.dir = "rtl";
        hebrewTitle.textContent = result.heRef;
        card.appendChild(hebrewTitle);
      }

      if (result.excerpt) {
        const excerpt = document.createElement("p");
        excerpt.className = "result-card-excerpt";
        excerpt.dir = "rtl";
        excerpt.textContent = result.excerpt;
        card.appendChild(excerpt);
      }

      const metaParts = [
        result.categories?.join(" › "),
        result.versionTitle,
        result.license
      ].filter(Boolean);
      if (metaParts.length) {
        const meta = document.createElement("p");
        meta.className = "result-card-meta";
        meta.textContent = metaParts.join(" · ");
        card.appendChild(meta);
      }

      if (result.availability === "browse") {
        const note = document.createElement("p");
        note.className = "result-card-warning";
        note.textContent = "Collection of sections — browse to choose a specific text.";
        card.appendChild(note);
      } else if (result.availability === "unavailable") {
        const note = document.createElement("p");
        note.className = "result-card-warning";
        note.textContent = "Hebrew is available, but it has no vowel points and is not suitable for automatic transliteration.";
        card.appendChild(note);
      } else if (result.quality?.status === "partial") {
        const note = document.createElement("p");
        note.className = "result-card-warning";
        note.textContent = "This source appears partially vocalized; review the transliteration carefully.";
        card.appendChild(note);
      }

      const actions = document.createElement("div");
      actions.className = "result-card-actions";
      if (result.availability === "import" || result.availability === "browse") {
        const button = document.createElement("button");
        button.className = result.availability === "browse" ? "result-button folder-button" : "result-button";
        button.type = "button";
        button.textContent = result.availability === "browse" ? "Browse sections" : "Import Hebrew";
        button.addEventListener("click", () => handleSefariaResultClick(result));
        actions.appendChild(button);
      }

      const link = document.createElement("a");
      link.className = "sefaria-source-link";
      link.href = result.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Sefaria";
      link.setAttribute("aria-label", `View ${result.ref} on Sefaria`);
      actions.appendChild(link);
      const versionSource = safeExternalUrl(result.versionSource);
      if (versionSource) {
        const versionLink = document.createElement("a");
        versionLink.className = "sefaria-source-link";
        versionLink.href = versionSource;
        versionLink.target = "_blank";
        versionLink.rel = "noopener noreferrer";
        versionLink.textContent = "Version";
        versionLink.setAttribute("aria-label", `View the source for ${result.versionTitle || result.ref}`);
        actions.appendChild(versionLink);
      }
      card.appendChild(actions);
      sefariaResults.appendChild(card);
    }

    const partialText = options.failedCount
      ? ` ${options.failedCount} additional result${options.failedCount === 1 ? " could" : "s could"} not be verified and ${options.failedCount === 1 ? "was" : "were"} hidden.`
      : "";
    const sourceWarning = options.partialMessage ? ` ${options.partialMessage}` : "";
    if (options.parentRef) {
      setSefariaStatus(`Showing ${uniqueResults.length} verified section${uniqueResults.length === 1 ? "" : "s"}.${partialText}${sourceWarning}`);
    } else {
      setSefariaStatus(`Found ${uniqueResults.length} verified result${uniqueResults.length === 1 ? "" : "s"}.${partialText}${sourceWarning}`);
    }
    return uniqueResults.length;
  }

  async function searchWrapper(query, size = 12, signal) {
    const data = await fetchJson("https://www.sefaria.org/api/search-wrapper", {
      method: "POST",
      headers: {
        // Sefaria accepts JSON with a simple content type, avoiding a browser CORS preflight.
        "Content-Type": "text/plain;charset=UTF-8"
      },
      signal,
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

  async function nameSearch(query, signal) {
    const nameUrl = `https://www.sefaria.org/api/name/${encodeURIComponent(query)}?limit=12&type=ref`;
    const nameData = await fetchJson(nameUrl, { signal });
    return extractNameResults(nameData).map((ref) => resultFromRef(ref, [], "name"));
  }

  async function searchSefaria(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      setSefariaStatus("Enter a prayer name, phrase, or exact reference.");
      return;
    }

    const controller = beginSefariaRequest();
    setSefariaStatus(`Searching Sefaria for ${trimmed}...`);
    sefariaImportSource.textContent = "";
    sefariaResults.textContent = "";
    sefariaNavigationStack = [];
    currentSefariaResults = null;

    try {
      const catalogResults = sefariaCatalog.resultsForQuery(trimmed);
      const useCatalog = catalogResults.length > 0;
      const aliasMatches = liturgyAliasesFor(trimmed);
      const aliasResults = aliasMatches.flatMap((alias) =>
        alias.refs.map((ref) => resultFromRef(ref, ["Liturgy"], "alias"))
      );
      const exactResults = /\d/.test(trimmed)
        ? [resultFromRef(trimmed, [], "exact")]
        : [];
      const queryTerms = [
        trimmed,
        ...aliasMatches.map((alias) => alias.hebrewQuery).filter(Boolean)
      ];

      const searches = useCatalog
        ? []
        : [
          nameSearch(trimmed, controller.signal),
          ...queryTerms.map((term) => searchWrapper(term, 12, controller.signal))
        ];
      const settledSearches = await Promise.allSettled(searches);
      const searchErrors = settledSearches.filter((result) => result.status === "rejected");
      const successfulSearchCount = settledSearches.length - searchErrors.length;
      const remoteResults = settledSearches.flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
      );

      if (!catalogResults.length && !exactResults.length && !aliasResults.length && !remoteResults.length && successfulSearchCount === 0) {
        throw searchErrors[0].reason;
      }

      setSefariaStatus(`Checking ${trimmed} results for usable Hebrew...`);
      const validated = await validateSefariaResults([
        ...catalogResults,
        ...exactResults,
        ...aliasResults,
        ...remoteResults
      ], trimmed, controller.signal);
      const partialMessage = searchErrors.length
        ? `${searchErrors.length} Sefaria search source${searchErrors.length === 1 ? " was" : "s were"} unavailable.`
        : "";
      const displayedResultCount = renderRefResults(validated.results, {
        query: trimmed,
        alreadyValidated: true,
        failedCount: validated.failedCount,
        partialMessage
      });
      recordUsageEvent(displayedResultCount > 0 ? "sefaria_search_succeeded" : "sefaria_search_zero_results");
      recordSefariaSearch(
        trimmed,
        displayedResultCount > 0 ? "succeeded" : "zero_results",
        displayedResultCount
      );
    } catch (error) {
      setSefariaStatus(sefariaErrorMessage(error));
      if (error?.code !== "cancelled") {
        recordUsageEvent("sefaria_search_failed");
        recordSefariaSearch(trimmed, "failed");
      }
    } finally {
      finishSefariaRequest(controller);
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
    importSefariaReference(sefariaQuery.value);
  });

  sefariaSearchButton.addEventListener("click", () => {
    searchSefaria(sefariaQuery.value);
  });

  sefariaCancelButton.addEventListener("click", () => {
    activeSefariaController?.abort();
  });

  verboseResultsToggle.addEventListener("change", () => {
    if (currentSefariaResults) {
      renderRefResults(
        currentSefariaResults.results,
        currentSefariaResults.options,
        { preserveStack: true }
      );
    }
  });

  sefariaQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchSefaria(sefariaQuery.value);
    }
  });

  window.addEventListener("offline", () => {
    if (!activeSefariaController) {
      setSefariaStatus("You are offline. Paste Hebrew directly to keep transliterating.");
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
