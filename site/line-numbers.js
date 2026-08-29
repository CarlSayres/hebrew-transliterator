(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HebrewTransliteratorLineNumbers = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  function startFromRef(ref) {
    const normalized = String(ref || "")
      .normalize("NFC")
      .replace(/[–—]/g, "-")
      .trim();
    const match = normalized.match(/(?:^|[\s,])(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?\s*$/);
    return match ? Number.parseInt(match[2], 10) : 1;
  }

  function add(text, start = 1) {
    const first = Number.isInteger(start) && start > 0 ? start : 1;
    return String(text || "")
      .split("\n")
      .map((line, index) => `${first + index}. ${line}`)
      .join("\n");
  }

  function remove(text, start = 1) {
    const first = Number.isInteger(start) && start > 0 ? start : 1;
    return String(text || "")
      .split("\n")
      .map((line, index) => line.replace(new RegExp(`^\\s*${first + index}\\.\\s?`), ""))
      .join("\n");
  }

  return { startFromRef, add, remove };
});
