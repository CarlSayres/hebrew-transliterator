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

  function numberAt(start, index) {
    if (Array.isArray(start)) return start[index] ?? null;
    return (Number.isInteger(start) && start > 0 ? start : 1) + index;
  }

  function add(text, start = 1) {
    return String(text || "")
      .split("\n")
      .map((line, index) => {
        const number = numberAt(start, index);
        return number === null ? line : number + ". " + line;
      })
      .join("\n");
  }

  function remove(text, start = 1) {
    return String(text || "")
      .split("\n")
      .map((line, index) => {
        const number = numberAt(start, index);
        return number === null ? line : line.replace(new RegExp("^\\s*" + number + "\\.\\s?"), "");
      })
      .join("\n");
  }

  // Keep imported verse labels attached to surviving lines. Newly inserted
  // lines have no verse number. A chapter boundary can restart the numbering.
  function afterEdit(before, after, numbers, visible) {
    const oldLines = before.split("\n");
    const newLines = after.split("\n");
    let start = 0;
    while (start < oldLines.length && oldLines[start] === newLines[start]) start++;
    let oldEnd = oldLines.length;
    let newEnd = newLines.length;
    while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const remaining = numbers.slice(start, oldEnd);
    const changed = newLines.slice(start, newEnd).map((line, index) => {
      if (!visible) return remaining[index] ?? null;
      const match = line.match(/^\s*(\d+)\.\s/);
      const number = match ? Number(match[1]) : null;
      const oldIndex = remaining.indexOf(number);
      if (number === null || oldIndex < 0) return null;
      remaining.splice(oldIndex, 1);
      return number;
    });
    return numbers.slice(0, start).concat(changed, numbers.slice(oldEnd));
  }

  return { startFromRef, add, remove, afterEdit };
});
