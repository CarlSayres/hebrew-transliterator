(function () {
  const input = document.getElementById("hebrewInput");
  const hebrewInputLabel = document.getElementById("hebrewInputLabel");
  const hebrewHighlightMirror = document.getElementById("hebrewHighlightMirror");
  const output = document.getElementById("transliterationOutput");
  const outputLabel = document.getElementById("outputLabel");
  const transliterationNotice = document.getElementById("transliterationNotice");
  const styleSelect = document.getElementById("styleSelect");
  const doubleDageshToggle = document.getElementById("doubleDageshToggle");
  const stressMarkToggle = document.getElementById("stressMarkToggle");
  const tzereOverrideRadios = Array.from(document.querySelectorAll("input[name='tzereOverride']"));
  const chetOverride = document.getElementById("chetOverride");
  const khafOverride = document.getElementById("khafOverride");
  const sampleButton = document.getElementById("sampleButton");
  const hebrewCopyButton = document.getElementById("hebrewCopyButton");
  const copyButton = document.getElementById("copyButton");
  const speechButton = document.getElementById("speechButton");
  const speechDownloadButton = document.getElementById("speechDownloadButton");
  const audioStatus = document.getElementById("audioStatus");
  const sefariaQuery = document.getElementById("sefariaQuery");
  const sefariaImportButton = document.getElementById("sefariaImportButton");
  const sefariaSearchButton = document.getElementById("sefariaSearchButton");
  const sefariaCancelButton = document.getElementById("sefariaCancelButton");
  const sefariaStartButtons = Array.from(document.querySelectorAll("[data-sefaria-start]"));
  const verboseResultsToggle = document.getElementById("verboseResultsToggle");
  const lineNumbersControl = document.getElementById("lineNumbersControl");
  const lineNumbersToggle = document.getElementById("lineNumbersToggle");
  const sefariaStatus = document.getElementById("sefariaStatus");
  const sefariaImportSource = document.getElementById("sefariaImportSource");
  const sefariaResults = document.getElementById("sefariaResults");
  const feedbackOpenButton = document.getElementById("feedbackOpenButton");
  const feedbackDialog = document.getElementById("feedbackDialog");
  const feedbackForm = document.getElementById("feedbackForm");
  const feedbackCloseButton = document.getElementById("feedbackCloseButton");
  const feedbackCancelButton = document.getElementById("feedbackCancelButton");
  const feedbackSubmitButton = document.getElementById("feedbackSubmitButton");
  const feedbackType = document.getElementById("feedbackType");
  const feedbackMessage = document.getElementById("feedbackMessage");
  const feedbackWebsite = document.getElementById("feedbackWebsite");
  const feedbackContextPanel = document.getElementById("feedbackContextPanel");
  const feedbackIncludeContext = document.getElementById("feedbackIncludeContext");
  const feedbackContextSummary = document.getElementById("feedbackContextSummary");
  const feedbackStatus = document.getElementById("feedbackStatus");
  const sefariaResultTools = window.HebrewTransliteratorSefaria;
  const sefariaCatalog = window.HebrewTransliteratorSefariaCatalog;
  const lineNumberTools = window.HebrewTransliteratorLineNumbers;
  const selectionAlignmentTools = window.HebrewTransliteratorSelectionAlignment;
  const speechTools = window.HebrewTransliteratorSpeech;
  const analyticsPageTools = window.HebrewTransliteratorAnalyticsPages;
  const sefariaClient = new window.HebrewTransliteratorSefariaClient.SefariaClient({
    timeoutMs: 9000,
    slowRequestMs: 5000,
    cacheTtlMs: 10 * 60 * 1000,
    cacheMaxEntries: 200,
    onSlow: () => noteSlowSefariaRequest(),
    onError: (error) => noteSefariaRequestError(error)
  });
  const preferencesCookieName = "ht_preferences";
  const preferencesCookieMaxAge = 60 * 60 * 24 * 365;

  const usageEventNames = new Set([
    "transliteration_copied",
    "hebrew_copied",
    "audio_listened",
    "audio_downloaded",
    "sefaria_search_succeeded",
    "sefaria_search_zero_results",
    "sefaria_search_failed",
    "sefaria_import_succeeded",
    "sefaria_import_failed",
    "feedback_sent",
    "style_selected"
  ]);

  function recordUsageEvent(eventName, sourceType = "") {
    if (!usageEventNames.has(eventName) || location.protocol === "file:") {
      return;
    }

    const audioEvent = ["audio_listened", "audio_downloaded"].includes(eventName);
    const body = JSON.stringify(audioEvent
      ? { schemaVersion: 3, event: eventName, sourceType }
      : { schemaVersion: 2, event: eventName });
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

  function readPreferenceCookie() {
    const prefix = `${preferencesCookieName}=`;
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    if (!cookie) {
      return null;
    }
    try {
      return JSON.parse(decodeURIComponent(cookie.slice(prefix.length)));
    } catch {
      return null;
    }
  }

  function hasSelectValue(select, value) {
    return Array.from(select?.options || []).some((option) => option.value === value);
  }

  function savePreferences() {
    const preferences = {
      version: 1,
      style: styleSelect.value,
      doubleDagesh: Boolean(doubleDageshToggle?.checked),
      stressMarks: Boolean(stressMarkToggle?.checked),
      tzere: tzereOverrideRadios.find((radio) => radio.checked)?.value || "e",
      chet: chetOverride?.value || "",
      khaf: khafOverride?.value || ""
    };
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${preferencesCookieName}=${encodeURIComponent(JSON.stringify(preferences))}; Max-Age=${preferencesCookieMaxAge}; Path=/; SameSite=Lax${secure}`;
  }

  function restorePreferences() {
    const preferences = readPreferenceCookie();
    if (preferences && rulesets.some((ruleset) => ruleset.id === preferences.style)) {
      styleSelect.value = preferences.style;
    }

    syncTzereOverrideToStyle();
    syncConsonantOverridesToStyle();
    if (!preferences) {
      return;
    }

    doubleDageshToggle.checked = Boolean(preferences.doubleDagesh);
    stressMarkToggle.checked = Boolean(preferences.stressMarks);
    if (["e", "ei"].includes(preferences.tzere)) {
      for (const radio of tzereOverrideRadios) {
        radio.checked = radio.value === preferences.tzere;
      }
    }
    if (hasSelectValue(chetOverride, preferences.chet)) {
      chetOverride.value = preferences.chet;
    }
    if (hasSelectValue(khafOverride, preferences.khaf)) {
      khafOverride.value = preferences.khaf;
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

  function recordVirtualPage(page, reference = "") {
    if (!page || typeof window.zaraz?.track !== "function") return;
    const properties = {
      page_location: `${location.origin}${page.path}`,
      page_path: page.path,
      page_title: page.title,
      content_group: page.path.startsWith("/Audio/") ? "Audio" : "Sefaria"
    };
    if (reference) properties.sefaria_reference = reference;
    try {
      void window.zaraz.track("page_view", properties);
      void window.zaraz.track(page.eventName, properties);
    } catch {
      // Optional analytics must never interfere with the application.
    }
  }

  const rulesets = window.HebrewRulesets.all || [window.HebrewRulesets.modernSefardi];
  let transliterator = new window.HebrewTransliterator.Transliterator(rulesets[0]);
  let sefariaNavigationStack = [];
  let currentSefariaResults = null;
  let activeSefariaController = null;
  let editorRevision = 0;
  let sefariaProblemDuringRequest = false;
  let lastSefariaSearch = "";
  let lastImportedSefariaContext = null;
  let feedbackSession = null;
  let verseNumbers = null;
  let previousVerseText = "";
  let currentAlignment = { text: "", segments: [] };
  let outputAlignmentSpans = [];
  let audioElement = null;
  let playingAudio = null;
  let audioObjectUrl = "";
  let audioCacheIdentity = "";
  let audioRequest = null;
  let audioRequestController = null;
  let speechSelectionSnapshot = null;

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

  function resizeHebrewInputToContent() {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
    syncHebrewHighlightScroll();
  }

  function updateOutput() {
    previousVerseText = verseNumbers ? input.value : "";
    stopAudio();
    clearPreparedAudio();
    speechSelectionSnapshot = null;
    currentAlignment = transliterator.transliterateWithAlignment(
      input.value,
      stressMarkToggle?.checked ? "stressMarks" : "text"
    );
    renderAlignedOutput();
    resizeHebrewInputToContent();
    clearLinkedHighlights();
    updateTransliterationNotice();
  }

  function renderAlignedOutput() {
    const fragment = document.createDocumentFragment();
    outputAlignmentSpans = [];
    let cursor = 0;

    currentAlignment.segments.forEach((segment, index) => {
      if (segment.targetStart > cursor) {
        fragment.append(document.createTextNode(currentAlignment.text.slice(cursor, segment.targetStart)));
      }
      const span = document.createElement("span");
      span.className = "aligned-output-word";
      span.dataset.alignmentIndex = String(index);
      span.textContent = currentAlignment.text.slice(segment.targetStart, segment.targetEnd);
      fragment.append(span);
      outputAlignmentSpans[index] = span;
      cursor = segment.targetEnd;
    });

    if (cursor < currentAlignment.text.length) {
      fragment.append(document.createTextNode(currentAlignment.text.slice(cursor)));
    }
    output.replaceChildren(fragment);
  }

  function syncHebrewHighlightScroll() {
    hebrewHighlightMirror.scrollTop = input.scrollTop;
    hebrewHighlightMirror.scrollLeft = input.scrollLeft;
  }

  function renderHebrewHighlights(indexes) {
    const ranges = selectionAlignmentTools.mergedRanges(
      currentAlignment.segments,
      indexes,
      "source"
    );
    if (!ranges.length) {
      hebrewHighlightMirror.replaceChildren();
      return;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        fragment.append(document.createTextNode(input.value.slice(cursor, range.start)));
      }
      const mark = document.createElement("mark");
      mark.textContent = input.value.slice(range.start, range.end);
      fragment.append(mark);
      cursor = range.end;
    }
    if (cursor < input.value.length) {
      fragment.append(document.createTextNode(input.value.slice(cursor)));
    }
    hebrewHighlightMirror.replaceChildren(fragment);
    syncHebrewHighlightScroll();
  }

  function renderOutputHighlights(indexes) {
    const selected = new Set(indexes);
    outputAlignmentSpans.forEach((span, index) => {
      span?.classList.toggle("alignment-match", selected.has(index));
    });
  }

  function clearLinkedHighlights() {
    renderOutputHighlights([]);
    renderHebrewHighlights([]);
  }

  function outputSelectionOffsets(selection) {
    if (
      !selection ||
      selection.rangeCount === 0 ||
      !output.contains(selection.anchorNode) ||
      !output.contains(selection.focusNode)
    ) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const prefix = document.createRange();
    prefix.selectNodeContents(output);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    return { start, end: start + range.toString().length };
  }

  function updateLinkedHighlightsFromSelection() {
    if (document.activeElement === input) {
      speechSelectionSnapshot = input.selectionStart !== input.selectionEnd
        ? speechTools.selectedOrAll(input.value, {
            start: input.selectionStart,
            end: input.selectionEnd
          }, currentAlignment.segments)
        : null;
      const indexes = selectionAlignmentTools.matchingIndexes(
        currentAlignment.segments,
        input.selectionStart,
        input.selectionEnd,
        "source"
      );
      renderHebrewHighlights(indexes);
      renderOutputHighlights(indexes);
      return;
    }

    const offsets = outputSelectionOffsets(window.getSelection());
    if (offsets) {
      speechSelectionSnapshot = speechTools.sourceForTargetSelection(
        input.value,
        currentAlignment.segments,
        offsets
      );
      const indexes = selectionAlignmentTools.matchingIndexes(
        currentAlignment.segments,
        offsets.start,
        offsets.end,
        "target"
      );
      renderOutputHighlights(indexes);
      renderHebrewHighlights(indexes);
      return;
    }

    if (speechSelectionSnapshot !== null) return;
    speechSelectionSnapshot = null;
    clearLinkedHighlights();
  }

  function selectedHebrewForSpeech() {
    if (
      document.activeElement === input &&
      Number.isInteger(input.selectionStart) &&
      input.selectionStart !== input.selectionEnd
    ) {
      return speechTools.selectedOrAll(input.value, {
        start: input.selectionStart,
        end: input.selectionEnd
      }, currentAlignment.segments);
    }
    const offsets = outputSelectionOffsets(window.getSelection());
    return speechTools.sourceForTargetSelection(
      input.value,
      currentAlignment.segments,
      offsets
    );
  }

  function audioPreparation(hebrew) {
    const tzere = tzereOverrideRadios.find((radio) => radio.checked)?.value || "e";
    const speechRuleset = speechTools.speechRuleset(
      window.HebrewRulesets.speechEnglish || window.HebrewRulesets.modernSefardi,
      tzere
    );
    const speechTransliterator = new window.HebrewTransliterator.Transliterator(speechRuleset);
    const { text, lexicon } = speechTools.prepareAzureHebrew(hebrew, speechTransliterator);
    const sourceType = speechTools.audioSourceType(
      input.value,
      lastImportedSefariaContext?.text || ""
    );
    const sourceRef = sourceType === "sefaria" ? (lastImportedSefariaContext?.ref || "") : "";
    return {
      text,
      sourceType,
      sourceRef,
      lexicon,
      identity: JSON.stringify({ text, sourceType, sourceRef, tzere, lexicon })
    };
  }

  function setAudioStatus(message, isError = false) {
    audioStatus.textContent = message;
    audioStatus.classList.toggle("error", isError);
  }

  function setAudioBusy(isBusy) {
    speechButton.disabled = isBusy && !playingAudio;
    speechDownloadButton.disabled = isBusy;
    audioStatus.classList.toggle("is-busy", isBusy);
    if (isBusy) setAudioStatus("Preparing audio…");
  }

  function setAudioPlaying(playing) {
    speechButton.textContent = playing ? "Stop Audio" : "Audio Listen";
    speechButton.setAttribute("aria-label", playing ? "Stop audio" : "Listen to audio");
  }

  function stopAudio() {
    if (playingAudio) {
      playingAudio.pause();
      playingAudio.currentTime = 0;
      if (playingAudio !== audioElement) URL.revokeObjectURL(playingAudio.src);
      playingAudio = null;
    }
    speechButton.disabled = Boolean(audioRequestController);
    setAudioPlaying(false);
  }

  function clearPreparedAudio() {
    audioRequestController?.abort();
    audioRequestController = null;
    audioRequest = null;
    audioCacheIdentity = "";
    if (audioObjectUrl && playingAudio !== audioElement) URL.revokeObjectURL(audioObjectUrl);
    audioElement = null;
    audioObjectUrl = "";
    setAudioBusy(false);
    setAudioStatus("");
  }

  function audioErrorMessage(response) {
    if (response?.status === 429) return "Audio is busy right now. Please wait a minute and try again.";
    if (response?.status === 413) return "That passage is too long for one audio file. Select a shorter portion and try again.";
    if (response?.status === 503) return "Audio is not configured yet. Please try again later.";
    return "Audio could not be created. Please try again in a few minutes.";
  }

  async function prepareAudio(hebrew) {
    const prepared = audioPreparation(hebrew);
    if (!prepared.text || !prepared.lexicon.length) {
      throw new Error("Select or enter vocalized Hebrew to create audio.");
    }
    if (audioElement && audioCacheIdentity === prepared.identity && audioObjectUrl) {
      return { ...prepared, audio: audioElement };
    }
    if (audioRequest && audioCacheIdentity === prepared.identity) return audioRequest;

    clearPreparedAudio();
    audioCacheIdentity = prepared.identity;
    const controller = new AbortController();
    audioRequestController = controller;
    setAudioBusy(true);
    audioRequest = (async () => {
      const response = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          schemaVersion: 2,
          text: prepared.text,
          sourceType: prepared.sourceType,
          sourceRef: prepared.sourceRef,
          tzere: tzereOverrideRadios.find((radio) => radio.checked)?.value || "e",
          lexicon: prepared.lexicon
        })
      });
      if (!response.ok) {
        const error = new Error(audioErrorMessage(response));
        error.status = response.status;
        throw error;
      }
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      if (response.headers.get("X-Audio-Cache") === "MISS") {
        recordVirtualPage(
          analyticsPageTools.audioPage("Generated", prepared.sourceRef),
          prepared.sourceRef
        );
      }
      audioObjectUrl = URL.createObjectURL(blob);
      audioElement = new Audio(audioObjectUrl);
      audioElement.addEventListener("ended", (event) => {
        if (event.currentTarget === playingAudio) stopAudio();
      });
      audioElement.addEventListener("error", (event) => {
        if (event.currentTarget !== playingAudio) return;
        stopAudio();
        setAudioStatus("The audio file could not be played.", true);
      });
      setAudioStatus(response.headers.get("X-Audio-Cache") === "HIT" ? "Audio ready from cache." : "Audio ready.");
      return { ...prepared, audio: audioElement };
    })();
    try {
      return await audioRequest;
    } finally {
      if (audioRequestController === controller) {
        audioRequestController = null;
        audioRequest = null;
        setAudioBusy(false);
      }
    }
  }

  function fallbackCopy(text) {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.left = "-10000px";
    document.body.append(temporary);
    temporary.select();
    const copied = document.execCommand("copy");
    temporary.remove();
    if (!copied) {
      throw new Error("Copy was not available.");
    }
  }

  async function copyText(text, button, restoredLabel, usageEvent) {
    if (!text) {
      return;
    }
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      copied = true;
    } catch {
      try {
        fallbackCopy(text);
        copied = true;
      } catch {
        button.textContent = "Copy failed";
        window.setTimeout(() => {
          button.textContent = restoredLabel;
        }, 1600);
      }
    }
    if (!copied) {
      return;
    }
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = restoredLabel;
    }, 1200);
    recordUsageEvent(usageEvent);
  }

  function addLineNumbers(text) {
    return lineNumberTools.add(text, verseNumbers);
  }

  function removeLineNumbers(text) {
    return lineNumberTools.remove(text, verseNumbers);
  }

  function supportsLineNumbers(result) {
    const categories = Array.isArray(result?.categories) ? result.categories : [];
    return categories.some((category) => String(category).toLowerCase() === "tanakh") ||
      /^Pirkei Avot(?:\s|,|$)/i.test(String(result?.ref || ""));
  }

  function setLineNumberAvailability(result) {
    const supported = supportsLineNumbers(result);
    verseNumbers = supported ? result.verseNumbers || result.text.split("\n")
      .map((_, index) => lineNumberTools.startFromRef(result.ref) + index) : null;
    lineNumbersToggle.checked = supported;
    lineNumbersControl.hidden = !supported;
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

  function remapStyleSensitiveExceptions(ruleset, selectedRuleset, chetValue, khafValue) {
    const baseChet = selectedRuleset.consonants["ח"];
    const baseKhaf = selectedRuleset.consonants["כ"].plain;
    if (baseChet === chetValue && baseKhaf === khafValue) return;
    const sounds = new RegExp([baseKhaf, baseChet].join("|"), "gi");
    for (const table of ["exactWords", "niqqudless", "phraseCapitalization"]) {
      for (const [word, value] of Object.entries(ruleset.exceptions[table])) {
        const letters = Array.from(word).filter((letter) => "חכך".includes(letter));
        let index = 0;
        ruleset.exceptions[table][word] = value.replace(sounds, (sound) => {
          const chet = baseChet === baseKhaf ? letters[index++] === "ח" : sound.toLowerCase() === baseChet;
          const replacement = chet ? chetValue : khafValue;
          return sound[0] === sound[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
        });
      }
    }
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
    for (const button of sefariaStartButtons) {
      button.disabled = isBusy;
    }
    sefariaCancelButton.hidden = !isBusy;
    sefariaStatus.classList.toggle("is-busy", isBusy);
    sefariaResults.setAttribute("aria-busy", String(isBusy));
  }

  function beginSefariaRequest() {
    activeSefariaController?.abort();
    activeSefariaController = new AbortController();
    sefariaProblemDuringRequest = false;
    setSefariaBusy(true);
    return activeSefariaController;
  }

  function finishSefariaRequest(controller) {
    if (activeSefariaController === controller) {
      activeSefariaController = null;
      setSefariaBusy(false);
    }
  }

  function cancelSefariaRequest() {
    if (!activeSefariaController) return;
    activeSefariaController.abort();
    finishSefariaRequest(activeSefariaController);
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
      return "Sefaria is having trouble responding. Please try again in a few minutes.";
    }
    if (error?.code === "no_text") {
      return error.message;
    }
    if (error?.status === 429) {
      return "Sefaria is receiving too many requests right now. Please try again in a few minutes.";
    }
    return error?.message
      ? `${error.message} Sefaria may be having a problem; please try again in a few minutes.`
      : "Sefaria appears to be having a problem. Please try again in a few minutes. You can still paste Hebrew directly into the editor.";
  }

  function noteSlowSefariaRequest() {
    if (!activeSefariaController) {
      return;
    }
    setSefariaStatus("Sefaria is taking longer than usual to respond. Please wait; if this does not finish, try again in a few minutes.");
  }

  function noteSefariaRequestError(error) {
    if (!activeSefariaController || error?.code === "cancelled") {
      return;
    }
    sefariaProblemDuringRequest = true;
    setSefariaStatus(sefariaErrorMessage(error));
  }

  function sefariaProblemWarning() {
    return activeSefariaController && sefariaProblemDuringRequest
      ? " Sefaria had trouble responding, so some results may be missing. Please try again in a few minutes."
      : "";
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
    return [...new Set(names)];
  }

  function childNodes(node) {
    return Array.isArray(node?.nodes) ? node.nodes : [];
  }

  function findSchemaPath(node, reference, parents = []) {
    if (!node) return null;
    const pathParts = [...parents, primaryNodeName(node)];
    for (const name of nodeNames(node)) {
      const key = normalizeRefPart(name);
      if (reference === key) return { node, pathParts };
      if (!reference.startsWith(key + ",")) continue;
      const remainder = reference.slice(key.length + 1).trim();
      for (const child of childNodes(node)) {
        const match = findSchemaPath(child, remainder, pathParts);
        if (match) return match;
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
    return sefariaResultTools.schemaNodeName(node) || nodeNames(node)[0] || "";
  }

  async function fetchSefariaIndex(title, signal) {
    const normalizedTitle = title.trim();
    const indexUrl = `https://www.sefaria.org/api/index/${encodeURIComponent(normalizedTitle)}`;
    return fetchJson(indexUrl, { signal });
  }

  function setHebrewSourceHeading(ref = "", schemaTitle = "") {
    hebrewInputLabel.textContent = schemaTitle ? `Vocalized Hebrew — ${schemaTitle}` : sefariaResultTools.importedTextHeading(ref);
    hebrewInputLabel.title = ref;
  }

  function insertImportedText(text) {
    input.value = text;
    updateOutput();
    input.setSelectionRange(0, 0);
    input.scrollTop = 0;
    input.focus();
    window.requestAnimationFrame(() => {
      if (input.value !== text || document.activeElement !== input) return;
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
  }

  function currentFeedbackContext() {
    const query = normalizedSefariaSearchTerm(sefariaQuery.value || lastSefariaSearch);
    if (!query && !lastImportedSefariaContext) {
      return null;
    }
    return {
      query: query.slice(0, 100),
      ref: lastImportedSefariaContext?.ref.slice(0, 300) || "",
      versionTitle: lastImportedSefariaContext?.versionTitle.slice(0, 300) || "",
      text: lastImportedSefariaContext?.text.slice(0, 20000) || ""
    };
  }

  function appendFeedbackContextDetail(label, value) {
    if (!value) {
      return;
    }
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    detail.title = value;
    feedbackContextSummary.append(term, detail);
  }

  function openFeedbackDialog() {
    const context = currentFeedbackContext();
    feedbackSession = { context, revision: 0 };
    feedbackSubmitButton.disabled = false;
    feedbackStatus.textContent = "";
    feedbackStatus.classList.remove("error");
    feedbackContextSummary.textContent = "";
    feedbackContextPanel.hidden = !context;
    feedbackIncludeContext.checked = Boolean(context);
    if (context) {
      appendFeedbackContextDetail("Search", context.query);
      appendFeedbackContextDetail("Reference", context.ref);
      appendFeedbackContextDetail("Edition", context.versionTitle);
      if (context.text) {
        appendFeedbackContextDetail("Imported text", `${context.text.length.toLocaleString()} characters`);
      }
    }
    feedbackDialog.showModal();
    feedbackMessage.focus();
  }

  function closeFeedbackDialog() {
    if (feedbackDialog.open) {
      feedbackDialog.close();
    }
  }

  async function submitFeedback(event) {
    event.preventDefault();
    if (!feedbackDialog.open || feedbackSubmitButton.disabled) return;
    const session = feedbackSession;
    const revision = session.revision;
    const sameDialog = () => feedbackDialog.open && feedbackSession === session;
    const message = feedbackMessage.value.trim();
    if (!message) {
      feedbackStatus.textContent = "Enter a feedback message.";
      feedbackStatus.classList.add("error");
      feedbackMessage.focus();
      return;
    }

    feedbackSubmitButton.disabled = true;
    feedbackStatus.textContent = "Sending feedback...";
    feedbackStatus.classList.remove("error");
    try {
      const context = feedbackIncludeContext.checked ? session.context : null;
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: feedbackType.value,
          message,
          website: feedbackWebsite.value,
          context
        })
      });
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("The feedback is too long. Shorten the message or uncheck the imported context.");
        }
        if (response.status === 429) {
          throw new Error("Too many feedback messages were sent recently. Please wait a minute and try again.");
        }
        throw new Error("Feedback could not be sent. Please try again shortly.");
      }
      recordUsageEvent("feedback_sent");
      if (!sameDialog()) return;
      if (session.revision !== revision) {
        feedbackStatus.textContent = "Your original feedback was sent. Your latest edits are still here.";
        return;
      }
      feedbackForm.reset();
      feedbackStatus.textContent = "Thank you—your feedback was sent.";
      window.setTimeout(() => {
        if (sameDialog() && session.revision === revision) closeFeedbackDialog();
      }, 1200);
    } catch (error) {
      if (!sameDialog()) return;
      feedbackStatus.textContent = error.message;
      feedbackStatus.classList.add("error");
    } finally {
      if (sameDialog()) feedbackSubmitButton.disabled = false;
    }
  }

  function displayImportedPassage(result, reference, initialRevision) {
    if (editorRevision !== initialRevision) {
      setSefariaStatus("The Hebrew changed during import. Your edits were kept.");
      return;
    }
    if (result.quality?.status === "missing") {
      throw new window.HebrewTransliteratorSefariaClient.SefariaRequestError(
        `No Hebrew text was found for ${reference}.`, "no_text"
      );
    }
    setLineNumberAvailability(result);
    insertImportedText(lineNumbersToggle.checked ? addLineNumbers(result.text) : result.text);
    lastImportedSefariaContext = {
      ref: result.ref || reference,
      versionTitle: result.versionTitle || "",
      text: result.text
    };
    const ref = lastImportedSefariaContext.ref;
    setHebrewSourceHeading(ref, result.source === "schemaLeaf" ? result.displayLabel : "");
    const warning = result.quality?.status === "unvocalized"
      ? " The source contains no vowel points, so transliteration will be limited."
      : result.quality?.status === "partial"
        ? " Some of the source appears only partially vocalized."
        : "";
    setSefariaStatus(`Imported ${ref}.${warning}${sefariaProblemWarning()}`);
    renderImportedSource(result);
    recordUsageEvent("sefaria_import_succeeded");
    recordVirtualPage(analyticsPageTools.sefariaPage(ref), ref);
  }

  async function importSefariaReference(reference, preparedResult = null) {
    const trimmed = reference.trim();
    if (!trimmed) {
      setSefariaStatus("Enter a Sefaria reference or search term.");
      return;
    }

    const controller = beginSefariaRequest();
    const initialRevision = editorRevision;
    setSefariaStatus(`Importing ${trimmed}...`);

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
      if (controller.signal.aborted) return;
      displayImportedPassage(result, trimmed, initialRevision);
    } catch (error) {
      if (activeSefariaController !== controller) return;
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

  function shortRefLabel(ref) {
    const parts = splitRefPath(ref);
    return parts[parts.length - 1] || ref;
  }

  async function validateSefariaResults(results, query, signal, resultLimit = 10) {
    const candidateLimit = resultLimit === 10 ? 12 : resultLimit;
    const candidates = sefariaResultTools.prepareResults(results, query || "", candidateLimit);
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
      results: usable.slice(0, resultLimit),
      failedCount: validated.length - usable.length,
      candidateCount: candidates.length
    };
  }

  async function schemaChildResults(result, signal) {
    const indexData = await fetchSefariaIndex(result.indexTitle || splitRefPath(result.ref)[0], signal);
    const match = findSchemaPath(indexData.schema, normalizeRefPart(result.ref));
    if (!match) return { pathParts: [], results: [] };
    const { node, pathParts } = match;
    const results = childNodes(node).map((child) => {
      const displayLabel = primaryNodeName(child);
      const childRef = appendRefPart(pathParts, displayLabel).join(", ");
      const hasChildren = childNodes(child).length > 0;
      return resultFromRef(
        childRef,
        indexData.categories || [],
        hasChildren ? "schema" : "schemaLeaf",
        { hasChildren, displayLabel }
      );
    });
    return { pathParts, results };
  }

  async function openSefariaResult(result) {
    const trimmed = result.ref.trim();
    if (!trimmed) {
      return;
    }

    const controller = beginSefariaRequest();
    setSefariaStatus(`Opening ${trimmed}...`);

    try {
      const { results: childResults, pathParts } = await schemaChildResults(result, controller.signal);
      if (controller.signal.aborted) return;
      if (childResults.length) {
        setSefariaStatus(`Checking sections in ${trimmed}...`);
        const pageSize = 30;
        const validated = await validateSefariaResults(childResults.slice(0, pageSize), "", controller.signal, pageSize);
        if (controller.signal.aborted) return;
        if (currentSefariaResults) {
          sefariaNavigationStack.push(currentSefariaResults);
        }
        renderRefResults(validated.results, {
          parentRef: trimmed,
          pathParts,
          alreadyValidated: true,
          failedCount: validated.failedCount,
          showAll: true,
          pagination: {
            allResults: childResults,
            page: 0,
            pageSize,
            total: childResults.length
          }
        });
        return;
      }
      setSefariaStatus(`This is a collection rather than a directly importable text. Use “View on Sefaria” to browse all of its sections.${sefariaProblemWarning()}`);
      renderImportedSource(result);
    } catch (error) {
      if (activeSefariaController !== controller) return;
      setSefariaStatus(sefariaErrorMessage(error));
    } finally {
      finishSefariaRequest(controller);
    }
  }

  async function showSefariaSectionPage(options, page) {
    const pagination = options.pagination;
    if (!pagination) {
      return;
    }

    const pageCount = Math.ceil(pagination.total / pagination.pageSize);
    const nextPage = Math.max(0, Math.min(page, pageCount - 1));
    const start = nextPage * pagination.pageSize;
    const pageResults = pagination.allResults.slice(start, start + pagination.pageSize);
    const controller = beginSefariaRequest();
    setSefariaStatus(`Checking sections ${start + 1}–${Math.min(start + pagination.pageSize, pagination.total)} of ${pagination.total}...`);

    try {
      const validated = await validateSefariaResults(pageResults, "", controller.signal, pagination.pageSize);
      if (controller.signal.aborted) return;
      renderRefResults(validated.results, {
        ...options,
        failedCount: validated.failedCount,
        pagination: {
          ...pagination,
          page: nextPage
        }
      }, { preserveStack: true });
    } catch (error) {
      if (activeSefariaController !== controller) return;
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
    if (result.availability === "import-reference") {
      importSefariaReference(result.ref);
      return;
    }
    if (result.availability === "browse" && result.chapters) {
      cancelSefariaRequest();
      const chapters = Array.from({ length: result.chapters }, (_value, index) => ({
        ref: `${result.ref} ${index + 1}`,
        displayLabel: String(index + 1),
        availability: "import-reference",
        source: "chapter"
      }));
      if (currentSefariaResults) {
        sefariaNavigationStack.push(currentSefariaResults);
      }
      renderRefResults(chapters, {
        parentRef: result.ref,
        alreadyValidated: true,
        chapterStrip: true,
        showAll: true,
        statusMessage: `Choose a chapter from ${result.ref}.`
      });
      return;
    }
    if (result.availability === "browse") {
      openSefariaResult(result);
    }
  }

  function goBackSefariaResults() {
    const previous = sefariaNavigationStack.pop();
    if (previous) {
      cancelSefariaRequest();
      renderRefResults(previous.results, previous.options, { preserveStack: true });
    }
  }

  function findSefariaBreadcrumbStateIndex(targetRef) {
    const target = normalizeRefPart(targetRef);
    return sefariaNavigationStack.findLastIndex(
      (state) => normalizeRefPart(state.options?.parentRef) === target
    );
  }

  function goToSefariaBreadcrumb(targetRef) {
    const stateIndex = findSefariaBreadcrumbStateIndex(targetRef);
    if (stateIndex < 0) {
      return;
    }

    const targetState = sefariaNavigationStack[stateIndex];
    cancelSefariaRequest();
    sefariaNavigationStack = sefariaNavigationStack.slice(0, stateIndex);
    renderRefResults(targetState.results, targetState.options, { preserveStack: true });
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
      const trail = document.createElement("div");
      trail.className = "sefaria-breadcrumb";
      trail.setAttribute("aria-label", "Sefaria location");

      const pathParts = options.pathParts || [options.parentRef];
      pathParts.forEach((part, index) => {
        if (index > 0) {
          const separator = document.createElement("span");
          separator.className = "sefaria-breadcrumb-separator";
          separator.textContent = "/";
          separator.setAttribute("aria-hidden", "true");
          trail.appendChild(separator);
        }

        const targetRef = pathParts.slice(0, index + 1).join(", ");
        const isCurrent = index === pathParts.length - 1;
        const stateIndex = findSefariaBreadcrumbStateIndex(targetRef);
        const breadcrumbButton = document.createElement("button");
        breadcrumbButton.className = "sefaria-breadcrumb-button";
        breadcrumbButton.type = "button";
        breadcrumbButton.textContent = part;

        if (isCurrent) {
          breadcrumbButton.disabled = true;
          breadcrumbButton.setAttribute("aria-current", "location");
        } else if (stateIndex >= 0) {
          breadcrumbButton.addEventListener("click", () => goToSefariaBreadcrumb(targetRef));
        } else {
          breadcrumbButton.disabled = true;
        }

        trail.appendChild(breadcrumbButton);
      });
      nav.appendChild(trail);
    }

    if (options.pagination) {
      const { page, pageSize, total } = options.pagination;
      const start = page * pageSize + 1;
      const end = Math.min(start + pageSize - 1, total);
      const pager = document.createElement("div");
      pager.className = "sefaria-pagination";

      const previousButton = document.createElement("button");
      previousButton.className = "result-button";
      previousButton.type = "button";
      previousButton.textContent = "Previous";
      previousButton.disabled = page === 0;
      previousButton.addEventListener("click", () => showSefariaSectionPage(options, page - 1));
      pager.appendChild(previousButton);

      const range = document.createElement("span");
      range.textContent = `${start}–${end} of ${total}`;
      pager.appendChild(range);

      const nextButton = document.createElement("button");
      nextButton.className = "result-button";
      nextButton.type = "button";
      nextButton.textContent = "Next";
      nextButton.disabled = end >= total;
      nextButton.addEventListener("click", () => showSefariaSectionPage(options, page + 1));
      pager.appendChild(nextButton);

      nav.appendChild(pager);
    }

    sefariaResults.appendChild(nav);
  }

  function renderRefResults(results, options = {}, renderOptions = {}) {
    sefariaResults.textContent = "";
    const verboseResults = verboseResultsToggle.checked && !options.chapterStrip;
    sefariaResults.classList.toggle("verbose-results", verboseResults);
    if (!renderOptions.preserveStack && !options.parentRef) {
      sefariaNavigationStack = [];
    }
    currentSefariaResults = { results, options };
    renderSefariaNavigation(options);

    let resultHost = sefariaResults;
    if (options.chapterStrip) {
      resultHost = document.createElement("div");
      resultHost.className = "chapter-number-strip";
      const chapterCollection = options.parentRef || options.chapterLabel || "this text";
      resultHost.setAttribute("aria-label", `Chapters in ${chapterCollection}`);
      sefariaResults.appendChild(resultHost);
    }

    const uniqueResults = options.alreadyValidated
      ? (options.showAll ? results : results.slice(0, 10))
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
      const label = result.displayLabel || (options.parentRef ? shortRefLabel(result.ref) : result.ref);

      if (!verboseResults) {
        const button = document.createElement("button");
        button.className = result.availability === "browse"
          ? "result-button folder-button"
          : "result-button page-button";
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

        resultHost.appendChild(button);
        continue;
      }

      const card = document.createElement("article");
      card.className = result.availability === "browse"
        ? "result-card result-card-folder"
        : "result-card result-card-page";

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
        button.className = result.availability === "browse" ? "result-button folder-button" : "result-button page-button";
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
      card.appendChild(actions);
      resultHost.appendChild(card);
    }

    const partialText = options.failedCount
      ? ` ${options.failedCount} additional result${options.failedCount === 1 ? " could" : "s could"} not be verified and ${options.failedCount === 1 ? "was" : "were"} hidden.`
      : "";
    const sourceWarning = options.partialMessage ? ` ${options.partialMessage}` : "";
    const serviceWarning = sefariaProblemWarning();
    if (options.statusMessage) {
      setSefariaStatus(`${options.statusMessage}${serviceWarning}`);
    } else if (options.pagination) {
      const start = options.pagination.page * options.pagination.pageSize + 1;
      const end = Math.min(start + options.pagination.pageSize - 1, options.pagination.total);
      setSefariaStatus(`Showing ${uniqueResults.length} verified section${uniqueResults.length === 1 ? "" : "s"} (${start}–${end} of ${options.pagination.total}).${partialText}${sourceWarning}${serviceWarning}`);
    } else if (options.parentRef) {
      setSefariaStatus(`Showing ${uniqueResults.length} verified section${uniqueResults.length === 1 ? "" : "s"}.${partialText}${sourceWarning}${serviceWarning}`);
    } else {
      setSefariaStatus(`Found ${uniqueResults.length} verified result${uniqueResults.length === 1 ? "" : "s"}.${partialText}${sourceWarning}${serviceWarning}`);
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
    lastSefariaSearch = trimmed;

    const catalogKey = sefariaCatalog.keyForQuery(trimmed);
    if (catalogKey && !sefariaCatalog.requiresValidation(catalogKey)) {
      cancelSefariaRequest();
      sefariaImportSource.textContent = "";
      const catalogResults = sefariaCatalog.resultsForKey(catalogKey);
      const label = sefariaCatalog.collectionLabels[catalogKey];
      const isChapterCollection = catalogKey === "pirkei_avot";
      sefariaQuery.value = label;
      const displayedResultCount = renderRefResults(catalogResults, {
        alreadyValidated: true,
        showAll: true,
        chapterStrip: isChapterCollection,
        chapterLabel: isChapterCollection ? label : "",
        statusMessage: isChapterCollection
          ? `Choose a chapter from ${label}.`
          : `Choose a book from ${label}.`
      });
      recordUsageEvent("sefaria_search_succeeded");
      recordSefariaSearch(label, "succeeded", displayedResultCount);
      return;
    }

    const controller = beginSefariaRequest();
    const initialRevision = editorRevision;
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
      // A verified numbered reference is a lookup. Full-text matches can be
      // other passages whose translations or footnotes merely cite it.
      const numbered = !useCatalog && /\d[ab]?\s*$/i.test(trimmed)
        ? await sefariaClient.validateResult(resultFromRef(trimmed, [], "exact"), { signal: controller.signal })
        : null;
      const exact = numbered && numbered.availability !== "invalid";
      const queryTerms = [
        trimmed,
        ...aliasMatches.map((alias) => alias.hebrewQuery).filter(Boolean)
      ];

      const searches = useCatalog || exact
        ? []
        : [
          nameSearch(trimmed, controller.signal),
          ...queryTerms.map((term) => searchWrapper(term, 12, controller.signal))
        ];
      const settledSearches = await Promise.allSettled(searches);
      if (controller.signal.aborted) {
        throw new window.HebrewTransliteratorSefariaClient.SefariaRequestError("Request cancelled.", "cancelled");
      }
      const searchErrors = settledSearches.filter((result) => result.status === "rejected");
      const successfulSearchCount = settledSearches.length - searchErrors.length;
      const remoteResults = settledSearches.flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
      );

      if (!catalogResults.length && !exact && !aliasResults.length && !remoteResults.length && successfulSearchCount === 0) {
        throw searchErrors[0].reason;
      }

      setSefariaStatus(`Checking ${trimmed} results for usable Hebrew...`);
      const validated = exact ? {
        results: numbered.valid ? [numbered] : [],
        failedCount: numbered.valid ? 0 : 1
      } : await validateSefariaResults([
        ...catalogResults,
        ...aliasResults,
        ...remoteResults
      ], trimmed, controller.signal);
      if (controller.signal.aborted) return;
      const directPassage = numbered?.kind === "text" ? numbered : validated.results.find(result =>
        !useCatalog && result.availability === "import" &&
        sefariaResultTools.normalizeRefKey(result.ref) === sefariaResultTools.normalizeRefKey(trimmed)
      );
      if (directPassage) {
        displayImportedPassage(directPassage, trimmed, initialRevision);
        recordUsageEvent("sefaria_search_succeeded");
        recordSefariaSearch(trimmed, "succeeded", 1);
        return;
      }
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
      if (activeSefariaController !== controller) return;
      setSefariaStatus(sefariaErrorMessage(error));
      if (error?.code !== "cancelled") {
        recordUsageEvent("sefaria_search_failed");
        recordSefariaSearch(trimmed, "failed");
      }
    } finally {
      finishSefariaRequest(controller);
    }
  }

  input.addEventListener("input", () => {
    if (verseNumbers) {
      verseNumbers = lineNumberTools.afterEdit(previousVerseText, input.value, verseNumbers, lineNumbersToggle.checked);
    }
    editorRevision += 1;
    setHebrewSourceHeading();
    updateOutput();
  });
  input.addEventListener("select", updateLinkedHighlightsFromSelection);
  input.addEventListener("keyup", updateLinkedHighlightsFromSelection);
  input.addEventListener("pointerup", updateLinkedHighlightsFromSelection);
  input.addEventListener("pointerdown", clearLinkedHighlights);
  input.addEventListener("scroll", syncHebrewHighlightScroll);
  output.addEventListener("pointerdown", clearLinkedHighlights);
  output.addEventListener("pointerup", updateLinkedHighlightsFromSelection);
  output.addEventListener("keyup", updateLinkedHighlightsFromSelection);
  document.addEventListener("selectionchange", updateLinkedHighlightsFromSelection);
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(syncHebrewHighlightScroll).observe(input);
  }
  let inputResizeFrame = 0;
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(inputResizeFrame);
    inputResizeFrame = window.requestAnimationFrame(resizeHebrewInputToContent);
  });

  hebrewCopyButton.addEventListener("click", () => {
    void copyText(input.value, hebrewCopyButton, "Copy", "hebrew_copied");
  });

  speechButton.addEventListener("pointerdown", (event) => {
    speechSelectionSnapshot ??= selectedHebrewForSpeech();
    event.preventDefault();
  });
  speechButton.addEventListener("click", async () => {
    if (playingAudio) {
      stopAudio();
      return;
    }
    const hebrew = speechSelectionSnapshot ?? selectedHebrewForSpeech() ?? input.value;
    try {
      const prepared = await prepareAudio(hebrew);
      playingAudio = prepared.audio;
      await prepared.audio.play();
      if (playingAudio !== prepared.audio) return;
      setAudioPlaying(true);
      recordUsageEvent("audio_listened", prepared.sourceType);
      recordVirtualPage(
        analyticsPageTools.audioPage("Listened", prepared.sourceRef),
        prepared.sourceRef
      );
    } catch (error) {
      if (playingAudio?.paused) stopAudio();
      if (error.name !== "AbortError") {
        setAudioStatus(error.message || "The audio could not be played.", true);
      }
    }
  });

  speechDownloadButton.addEventListener("pointerdown", (event) => {
    speechSelectionSnapshot ??= selectedHebrewForSpeech();
    event.preventDefault();
  });
  speechDownloadButton.addEventListener("click", async () => {
    const hebrew = speechSelectionSnapshot ?? selectedHebrewForSpeech() ?? input.value;
    try {
      const prepared = await prepareAudio(hebrew);
      const link = document.createElement("a");
      const sourceName = prepared.sourceType === "sefaria"
        ? (lastImportedSefariaContext?.ref || "sefaria")
        : "hebrew-audio";
      link.href = audioObjectUrl;
      link.download = `${sourceName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "hebrew-audio"}.mp3`;
      document.body.append(link);
      link.click();
      link.remove();
      recordUsageEvent("audio_downloaded", prepared.sourceType);
      recordVirtualPage(
        analyticsPageTools.audioPage("Downloaded", prepared.sourceRef),
        prepared.sourceRef
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        setAudioStatus(error.message || "The audio could not be downloaded.", true);
      }
    }
  });

  styleSelect.addEventListener("change", () => {
    setStyle(styleSelect.value);
    savePreferences();
    recordUsageEvent("style_selected");
  });

  doubleDageshToggle?.addEventListener("change", () => {
    setOptions();
    savePreferences();
  });
  stressMarkToggle?.addEventListener("change", () => {
    updateOutput();
    savePreferences();
  });
  for (const radio of tzereOverrideRadios) {
    radio.addEventListener("change", () => {
      setOptions();
      savePreferences();
    });
  }
  chetOverride?.addEventListener("change", () => {
    setOptions();
    savePreferences();
  });
  khafOverride?.addEventListener("change", () => {
    setOptions();
    savePreferences();
  });

  sampleButton.addEventListener("click", () => {
    editorRevision += 1;
    lastImportedSefariaContext = null;
    setHebrewSourceHeading();
    setLineNumberAvailability(null);
    input.value = sampleText;
    updateOutput();
    input.focus();
  });

  sefariaImportButton.addEventListener("click", () => {
    lastSefariaSearch = normalizedSefariaSearchTerm(sefariaQuery.value);
    importSefariaReference(sefariaQuery.value);
  });

  feedbackOpenButton.addEventListener("click", openFeedbackDialog);
  feedbackCloseButton.addEventListener("click", closeFeedbackDialog);
  feedbackCancelButton.addEventListener("click", closeFeedbackDialog);
  feedbackForm.addEventListener("submit", submitFeedback);
  feedbackForm.addEventListener("input", () => {
    if (feedbackSession) feedbackSession.revision++;
  });
  feedbackDialog.addEventListener("click", (event) => {
    if (event.target === feedbackDialog) {
      closeFeedbackDialog();
    }
  });

  sefariaSearchButton.addEventListener("click", () => {
    searchSefaria(sefariaQuery.value);
  });

  for (const button of sefariaStartButtons) {
    button.addEventListener("click", () => {
      const key = button.dataset.sefariaStart;
      const label = sefariaCatalog.collectionLabels[key];
      sefariaQuery.value = label;
      searchSefaria(label);
    });
  }

  sefariaCancelButton.addEventListener("click", () => {
    cancelSefariaRequest();
    setSefariaStatus("Sefaria request cancelled.");
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

  lineNumbersToggle.addEventListener("change", () => {
    const pageScroll = { left: window.scrollX, top: window.scrollY };
    const inputScroll = { left: input.scrollLeft, top: input.scrollTop };
    input.value = lineNumbersToggle.checked
      ? addLineNumbers(input.value)
      : removeLineNumbers(input.value);
    updateOutput();
    input.scrollLeft = inputScroll.left;
    input.scrollTop = inputScroll.top;
    window.requestAnimationFrame(() => {
      input.scrollLeft = inputScroll.left;
      input.scrollTop = inputScroll.top;
      window.scrollTo(pageScroll);
    });
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

  copyButton.addEventListener("click", () => {
    void copyText(output.textContent, copyButton, "Copy", "transliteration_copied");
  });

  window.addEventListener("pagehide", () => {
    stopAudio();
    clearPreparedAudio();
  });

  populateStyleSelect();
  restorePreferences();
  refreshTransliterator();
  if (new URLSearchParams(location.search).get("feedback") === "1") {
    window.requestAnimationFrame(openFeedbackDialog);
  }
})();
