(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HebrewTransliteratorSefariaClient = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const DEFAULT_TIMEOUT_MS = 9000;
  const DEFAULT_SLOW_REQUEST_MS = 5000;
  const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
  const DEFAULT_CACHE_MAX_ENTRIES = 200;
  const HEBREW_LETTER_RE = /[\u05d0-\u05ea]/g;
  const HEBREW_VOWEL_RE = /[\u05b0-\u05bb\u05c7]/g;

  class SefariaRequestError extends Error {
    constructor(message, code, options = {}) {
      super(message);
      this.name = "SefariaRequestError";
      this.code = code;
      this.status = options.status;
      this.cause = options.cause;
    }
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&(nbsp|thinsp|ensp|emsp|hairsp);|&#160;|&#xA0;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
      .trim();
  }

  function flattenText(value) {
    if (Array.isArray(value)) {
      return value.map(flattenText).filter(Boolean).join("\n");
    }
    return typeof value === "string" ? cleanText(value) : "";
  }

  function textQuality(text) {
    const letters = text.match(HEBREW_LETTER_RE)?.length || 0;
    const vowels = text.match(HEBREW_VOWEL_RE)?.length || 0;
    if (!letters) {
      return { status: "missing", letters, vowels };
    }
    if (!vowels) {
      return { status: "unvocalized", letters, vowels };
    }
    return {
      status: vowels / letters < 0.18 ? "partial" : "vocalized",
      letters,
      vowels
    };
  }

  function excerptFromText(text, maxLength = 180) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength).trimEnd()}…`;
  }

  function sefariaUrl(urlRef, fallbackRef) {
    const path = urlRef || String(fallbackRef || "").trim().replace(/\s+/g, "_");
    return `https://www.sefaria.org/${encodeURI(path)}`;
  }

  function isFolderMetadata(metadata) {
    if (metadata.node_type === "SchemaNode") {
      return true;
    }
    const depth = Number(metadata.depth) || 0;
    const indexes = Array.isArray(metadata.start_indexes) ? metadata.start_indexes : [];
    return depth > 1 && indexes.length < depth - 1;
  }

  function v3Payload(data, fallbackRef) {
    const versions = Array.isArray(data?.versions) ? data.versions : [];
    const version = versions.find((candidate) => candidate?.language === "he" || candidate?.actualLanguage === "he") || versions[0];
    const text = flattenText(version?.text || data?.text || data?.he);
    return {
      text,
      ref: data?.ref || fallbackRef,
      heRef: data?.heRef || "",
      categories: Array.isArray(data?.categories) ? data.categories : [],
      versionTitle: version?.versionTitle || "",
      license: version?.license || "",
      versionSource: version?.versionSource || version?.versionUrl || ""
    };
  }

  function v1Payload(data, fallbackRef) {
    return {
      text: flattenText(data?.he || data?.text),
      ref: data?.ref || fallbackRef,
      heRef: data?.heRef || "",
      categories: Array.isArray(data?.categories) ? data.categories : [],
      versionTitle: data?.heVersionTitle || data?.versionTitle || "",
      license: data?.heLicense || data?.license || "",
      versionSource: data?.heVersionSource || data?.versionSource || ""
    };
  }

  class SefariaClient {
    constructor(options = {}) {
      this.fetchImpl = options.fetchImpl || ((...args) => fetch(...args));
      this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
      this.slowRequestMs = options.slowRequestMs || DEFAULT_SLOW_REQUEST_MS;
      this.cacheTtlMs = options.cacheTtlMs || DEFAULT_CACHE_TTL_MS;
      this.cacheMaxEntries = options.cacheMaxEntries || DEFAULT_CACHE_MAX_ENTRIES;
      this.onSlow = typeof options.onSlow === "function" ? options.onSlow : () => {};
      this.onError = typeof options.onError === "function" ? options.onError : () => {};
      this.now = typeof options.now === "function" ? options.now : () => Date.now();
      this.responseCache = new Map();
      this.pendingRequests = new Map();
    }

    cacheKey(url, options = {}) {
      const method = String(options.method || "GET").toUpperCase();
      const body = typeof options.body === "string" ? options.body : "";
      return `${method} ${url}\n${body}`;
    }

    cachedResponse(key) {
      const cached = this.responseCache.get(key);
      if (!cached) {
        return undefined;
      }
      if (cached.expiresAt <= this.now()) {
        this.responseCache.delete(key);
        return undefined;
      }
      // Touch the entry so Map insertion order acts as a small LRU cache.
      this.responseCache.delete(key);
      this.responseCache.set(key, cached);
      return cached.data;
    }

    storeResponse(key, data) {
      this.responseCache.delete(key);
      this.responseCache.set(key, {
        data,
        expiresAt: this.now() + this.cacheTtlMs
      });
      while (this.responseCache.size > this.cacheMaxEntries) {
        this.responseCache.delete(this.responseCache.keys().next().value);
      }
    }

    clearSessionCache() {
      this.responseCache.clear();
    }

    notifyError(error, context) {
      try {
        this.onError(error, context);
      } catch {
        // Status reporting must never change request behavior.
      }
    }

    requestJson(url, options = {}) {
      const parentSignal = options.signal;
      if (parentSignal?.aborted) {
        return Promise.reject(new SefariaRequestError("The Sefaria request was cancelled.", "cancelled"));
      }

      const key = this.cacheKey(url, options);
      const cached = options.useCache === false ? undefined : this.cachedResponse(key);
      if (cached !== undefined) {
        return Promise.resolve(cached);
      }
      if (options.useCache !== false && this.pendingRequests.has(key)) {
        return this.pendingRequests.get(key);
      }

      const request = this.performRequestJson(url, options)
        .then((data) => {
          if (options.useCache !== false) {
            this.storeResponse(key, data);
          }
          return data;
        })
        .finally(() => {
          if (this.pendingRequests.get(key) === request) {
            this.pendingRequests.delete(key);
          }
        });

      if (options.useCache !== false) {
        this.pendingRequests.set(key, request);
      }
      return request;
    }

    async performRequestJson(url, options = {}) {
      const controller = new AbortController();
      const parentSignal = options.signal;
      let timedOut = false;
      let slowNotified = false;
      const abortFromParent = () => controller.abort(parentSignal?.reason);
      if (parentSignal?.aborted) {
        throw new SefariaRequestError("The Sefaria request was cancelled.", "cancelled");
      }
      parentSignal?.addEventListener("abort", abortFromParent, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeoutMs || this.timeoutMs);
      const slowTimer = setTimeout(() => {
        slowNotified = true;
        try {
          this.onSlow({ url, method: String(options.method || "GET").toUpperCase() });
        } catch {
          // Status reporting must never change request behavior.
        }
      }, options.slowRequestMs || this.slowRequestMs);

      try {
        const {
          useCache: _useCache,
          slowRequestMs: _slowRequestMs,
          timeoutMs: _timeoutMs,
          ...fetchOptions
        } = options;
        const response = await this.fetchImpl(url, {
          ...fetchOptions,
          signal: controller.signal
        });
        if (!response.ok) {
          throw new SefariaRequestError(`Sefaria returned ${response.status}.`, "http", {
            status: response.status
          });
        }
        return await response.json();
      } catch (error) {
        if (error instanceof SefariaRequestError) {
          if (error.code !== "cancelled") {
            this.notifyError(error, { url, slowNotified });
          }
          throw error;
        }
        if (timedOut) {
          const requestError = new SefariaRequestError("Sefaria took too long to respond.", "timeout", { cause: error });
          this.notifyError(requestError, { url, slowNotified });
          throw requestError;
        }
        if (parentSignal?.aborted || error?.name === "AbortError") {
          throw new SefariaRequestError("The Sefaria request was cancelled.", "cancelled", { cause: error });
        }
        const requestError = new SefariaRequestError("Sefaria could not be reached.", "network", { cause: error });
        this.notifyError(requestError, { url, slowNotified });
        throw requestError;
      } finally {
        clearTimeout(timer);
        clearTimeout(slowTimer);
        parentSignal?.removeEventListener("abort", abortFromParent);
      }
    }

    async inspectReference(reference, options = {}) {
      const trimmed = String(reference || "").trim();
      const url = `https://www.sefaria.org/api/ref/${encodeURIComponent(trimmed)}`;
      const data = await this.requestJson(url, options);
      if (!data?.is_ref) {
        return { valid: false, ref: trimmed, reason: "invalid_ref" };
      }

      const ref = data.normalized || trimmed;
      return {
        valid: true,
        kind: isFolderMetadata(data) ? "folder" : "text",
        ref,
        heRef: data.hebrew || "",
        indexTitle: data.index_title || "",
        nodeType: data.node_type || "",
        depth: data.depth,
        firstAvailableSectionRef: data.navigation_refs?.first_available_section_ref || "",
        sourceUrl: sefariaUrl(data.url_ref, ref)
      };
    }

    async loadText(reference, options = {}) {
      const trimmed = String(reference || "").trim();
      const encodedRef = encodeURIComponent(trimmed);
      const v3Url = `https://www.sefaria.org/api/v3/texts/${encodedRef}?version=source&return_format=text_only`;
      let v3Error;

      try {
        const data = await this.requestJson(v3Url, options);
        const payload = v3Payload(data, trimmed);
        if (payload.text) {
          return payload;
        }
      } catch (error) {
        if (error.code === "cancelled" || error.code === "timeout" || error.status === 429) {
          throw error;
        }
        v3Error = error;
      }

      const v1Url = `https://www.sefaria.org/api/texts/${encodedRef}?context=0&commentary=0`;
      try {
        const data = await this.requestJson(v1Url, options);
        const payload = v1Payload(data, trimmed);
        if (payload.text) {
          return payload;
        }
      } catch (error) {
        if (error.code === "cancelled" || error.code === "timeout") {
          throw error;
        }
        throw v3Error || error;
      }

      throw new SefariaRequestError(`No Hebrew text was found for ${trimmed}.`, "no_text");
    }

    async validateResult(result, options = {}) {
      const reference = typeof result === "string" ? result : result?.ref;
      const base = typeof result === "string" ? { ref: result } : { ...result };
      const referenceInfo = await this.inspectReference(reference, options);
      if (!referenceInfo.valid) {
        return { ...base, ...referenceInfo, availability: "invalid" };
      }

      if (referenceInfo.kind === "folder") {
        let quality;
        const sampleRef = base.sampleRef || referenceInfo.firstAvailableSectionRef;
        if (sampleRef) {
          const sample = await this.loadText(sampleRef, options);
          quality = textQuality(sample.text);
          if (quality.status === "missing" || quality.status === "unvocalized") {
            return {
              ...base,
              ...referenceInfo,
              categories: base.categories || [],
              quality,
              valid: false,
              availability: "unavailable"
            };
          }
        }

        return {
          ...base,
          ...referenceInfo,
          categories: base.categories || [],
          quality,
          availability: "browse"
        };
      }

      const payload = await this.loadText(referenceInfo.ref, options);
      const quality = textQuality(payload.text);
      return {
        ...base,
        ...referenceInfo,
        ...payload,
        ref: payload.ref || referenceInfo.ref,
        heRef: payload.heRef || referenceInfo.heRef,
        categories: payload.categories.length ? payload.categories : base.categories || [],
        sourceUrl: referenceInfo.sourceUrl,
        excerpt: excerptFromText(payload.text),
        quality,
        availability: quality.status === "missing" || quality.status === "unvocalized" ? "unavailable" : "import"
      };
    }
  }

  return {
    SefariaClient,
    SefariaRequestError,
    cleanText,
    excerptFromText,
    flattenText,
    isFolderMetadata,
    sefariaUrl,
    textQuality,
    v1Payload,
    v3Payload
  };
});
