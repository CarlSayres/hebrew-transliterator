(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HebrewTransliteratorSelectionAlignment = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  function matchingIndexes(segments, start, end, axis) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start === end) {
      return [];
    }
    const rangeStart = Math.min(start, end);
    const rangeEnd = Math.max(start, end);
    const startKey = axis === "target" ? "targetStart" : "sourceStart";
    const endKey = axis === "target" ? "targetEnd" : "sourceEnd";

    return segments.reduce((matches, segment, index) => {
      if (rangeStart < segment[endKey] && rangeEnd > segment[startKey]) {
        matches.push(index);
      }
      return matches;
    }, []);
  }

  function mergedRanges(segments, indexes, axis) {
    const startKey = axis === "target" ? "targetStart" : "sourceStart";
    const endKey = axis === "target" ? "targetEnd" : "sourceEnd";
    const ranges = indexes
      .map((index) => segments[index])
      .filter(Boolean)
      .map((segment) => ({ start: segment[startKey], end: segment[endKey] }))
      .filter((range) => range.end > range.start)
      .sort((left, right) => left.start - right.start || left.end - right.end);

    return ranges.reduce((merged, range) => {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push({ ...range });
      }
      return merged;
    }, []);
  }

  return { matchingIndexes, mergedRanges };
});
