(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HebrewTransliteratorAnalyticsPages = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const audioActions = new Set(["Generated", "Listened", "Downloaded"]);

  function referenceSegments(reference) {
    return String(reference || "")
      .normalize("NFC")
      .replace(/[\0\r\n]/g, " ")
      .split(",")
      .map((segment) => segment.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  function encodedPath(segments) {
    return `/${segments
      .map((segment) => segment
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9._~-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "") || "Reference")
      .join("/")}`;
  }

  function sefariaPage(reference) {
    const segments = referenceSegments(reference);
    if (!segments.length) return null;
    return {
      path: encodedPath(["Sefaria", ...segments]),
      title: `Sefaria: ${segments.join(" › ")}`,
      eventName: "sefaria_reference_viewed"
    };
  }

  function audioPage(action, reference) {
    if (!audioActions.has(action)) return null;
    const segments = referenceSegments(reference);
    const labelSegments = segments.length ? segments : ["Arbitrary Hebrew"];
    return {
      path: encodedPath(["Audio", action, ...labelSegments]),
      title: `Audio ${action}: ${labelSegments.join(" › ")}`,
      eventName: `audio_${action.toLowerCase()}`
    };
  }

  return { referenceSegments, sefariaPage, audioPage };
});
