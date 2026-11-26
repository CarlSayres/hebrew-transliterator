// Run with Playwright installed and BROWSER_CHANNEL set to chrome or msedge.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

test("editor, imports, preferences, selection and audio attribution", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  try {
    const page = await browser.newPage();
    const site = "http://localhost:8787";
    const audioRequests = [];
    const feedbackRequests = [];
    const fullTextQueries = [];
    const amida = "Amida for Maariv, Shacharit, Mincha";
    const errors = [];
    let passage = [];
    let audioAvailable = false;
    let holdImport;
    let importStarted;
    let holdFeedback;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.players = [];
      window.Audio = class extends EventTarget {
        constructor(src) {
          super();
          this.src = src;
          this.paused = true;
          window.players.push(this);
        }
        async play() { this.paused = false; }
        pause() { this.paused = true; }
      };
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "www.sefaria.org") {
        const ref = decodeURIComponent(url.pathname.split("/").at(-1));
        if (url.pathname.startsWith("/api/name/")) {
          return route.fulfill({ json: { completions: [ref] } });
        }
        if (url.pathname.includes("/search-wrapper")) {
          const { query } = route.request().postDataJSON();
          fullTextQueries.push(query);
          const citedRefs = {
            "Genesis 35:22": ["Deuteronomy 33:6"],
            "prayer 42": ["Deuteronomy 33:6"],
            covenant: ["Genesis 9:12", "Exodus 2:24"],
            "Siddur Demo, Morning, Prayer": ["Genesis 9:12"]
          };
          const hits = (citedRefs[query] || []).map(ref => ({ _source: { ref, categories: ["Tanakh"] } }));
          return route.fulfill({ json: { hits: { hits } } });
        }
        if (url.pathname.startsWith("/api/index/")) {
          return route.fulfill({ json: { schema: { key: "Siddur Demo", nodes: [
            { key: "Morning", nodes: [{ key: "Prayer" }] },
            { key: amida, nodes: [{ key: "Avot" }, { key: "Gevurot" }, { key: "Kedusha" }] }
          ] }, categories: ["Liturgy"] } });
        }
        if (url.pathname.startsWith("/api/ref/")) {
          if (ref === "prayer 42") return route.fulfill({ status: 404 });
          if (["Siddur Demo", "Siddur Demo, Morning", "Siddur Demo, " + amida].includes(ref)) {
            return route.fulfill({ json: { is_ref: true, normalized: ref, node_type: "SchemaNode" } });
          }
          if (ref === "Genesis") return route.fulfill({ json: { is_ref: true, normalized: ref, depth: 2, start_indexes: [] } });
          return route.fulfill({ json: { is_ref: true, normalized: ref, depth: 2, start_indexes: [1], url_ref: ref } });
        }
        if (importStarted) importStarted();
        if (holdImport) await holdImport;
        return route.fulfill({ json: { ref, categories: ["Tanakh"], versions: [{ language: "he", text: passage, versionSource: "https://example.org/edition" }] } });
      }
      if (url.pathname === "/api/feedback") {
        feedbackRequests.push(route.request().postDataJSON());
        if (holdFeedback) await holdFeedback;
        return route.fulfill({ status: 204 });
      }
      if (url.pathname === "/api/audio") {
        audioRequests.push(route.request().postDataJSON());
        if (audioAvailable) return route.fulfill({ status: 200, contentType: "audio/mpeg", body: "local test" });
        return route.fulfill({ status: 503 });
      }
      if (url.origin !== site || url.pathname.startsWith("/api/") || url.pathname.startsWith("/cdn-cgi/")) {
        return route.fulfill({ status: 204 });
      }
      const file = path.join(__dirname, "../site", url.pathname === "/" ? "index.html" : url.pathname);
      return route.fulfill({ path: file });
    });
    await page.goto(site);
    const editor = page.locator("#hebrewInput");
    const output = page.locator("#transliterationOutput");
    await page.selectOption("#styleSelect", "levShalem");
    await page.selectOption("#chetOverride", "ch");
    await page.selectOption("#khafOverride", "ḥ");
    await editor.fill("לָךְ מֶלֶךְ");
    assert.equal((await output.textContent()).normalize("NFC"), "Laḥ meleḥ");

    await page.selectOption("#styleSelect", "mishkanTefilah");
    await page.selectOption("#chetOverride", "h");
    await page.selectOption("#khafOverride", "kh");
    assert.equal(await output.textContent(), "Lakh melekh");

    const importRef = async (ref) => {
      await page.fill("#sefariaQuery", ref);
      await page.click("#sefariaImportButton");
    };
    for (const action of ["edit", "sample"]) {
      const started = new Promise((resolve) => { importStarted = resolve; });
      let release;
      holdImport = new Promise((resolve) => { release = resolve; });
      passage = ["שָׁלוֹם"];
      await importRef(action === "edit" ? "Genesis 1:1" : "Genesis 1:2");
      await started;
      if (action === "edit") await editor.fill("my new passage");
      else await page.click("#sampleButton");
      const expected = await editor.inputValue();
      release();
      await page.waitForFunction(() => document.querySelector("#sefariaStatus").textContent.includes("edits were kept"));
      assert.equal(await editor.inputValue(), expected);
      holdImport = importStarted = null;
    }

    passage = [["שְׁמַע"], ["יִשְׂרָאֵל", "", "שָׁלוֹם"]];
    await importRef("Genesis 1:31-2:3");
    await page.waitForFunction(() => document.querySelector("#hebrewInput").value.startsWith("31."));
    const numbered = await editor.inputValue();
    const sourceLinks = page.locator("#sefariaImportSource a");
    assert.deepEqual(await sourceLinks.allTextContents(), ["View on Sefaria"]);
    assert.match(await sourceLinks.first().getAttribute("href"), /^https:\/\/www\.sefaria\.org\//);
    assert.equal(numbered, "31. שְׁמַע\n1. יִשְׂרָאֵל\n3. שָׁלוֹם");
    await page.uncheck("#lineNumbersToggle");
    await page.check("#lineNumbersToggle");
    assert.equal(await editor.inputValue(), numbered);

    await editor.fill(numbered.slice(numbered.indexOf("\n") + 1));
    await page.uncheck("#lineNumbersToggle");
    assert.equal(await editor.inputValue(), "יִשְׂרָאֵל\nשָׁלוֹם");
    await page.check("#lineNumbersToggle");
    const surviving = await editor.inputValue();
    assert.equal(surviving, "1. יִשְׂרָאֵל\n3. שָׁלוֹם");
    passage = ["English only"];
    await importRef("Genesis 2");
    await page.waitForFunction(() => document.querySelector("#sefariaStatus").textContent.includes("No Hebrew text"));
    assert.equal(await editor.inputValue(), surviving);

    await editor.fill("ה׳ hello");
    const chooseEnglish = async () => {
      await output.evaluate((el) => {
        el.focus();
        const node = el.lastChild;
        const start = node.textContent.indexOf("hello");
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 5);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        el.dispatchEvent(new Event("pointerup"));
      });
    };
    for (const button of ["#speechButton", "#speechDownloadButton"]) {
      await chooseEnglish();
      await page.click(button);
      await page.waitForFunction(() => document.querySelector("#audioStatus").textContent.includes("vocalized Hebrew"));
      assert.equal(audioRequests.length, 0);
    }

    passage = ["שָׁלוֹם ".repeat(2700).trim()];
    await importRef("Genesis 3:1");
    await page.waitForFunction(() => document.querySelector("#hebrewInput").value.length > 20000);
    await editor.evaluate((el) => {
      el.focus();
      el.setSelectionRange(3, el.value.indexOf(" ", 3));
      el.dispatchEvent(new Event("select"));
    });
    await page.click("#speechDownloadButton");
    await page.waitForFunction(() => document.querySelector("#audioStatus").textContent.includes("configured"));
    assert.equal(audioRequests.length, 1);
    assert.equal(audioRequests[0].sourceType, "sefaria");
    assert.equal(audioRequests[0].sourceRef, "Genesis 3:1");
    assert.equal(audioRequests[0].text, "שָׁלוֹם".normalize("NFC"));
    await page.click("#feedbackOpenButton");
    await page.fill("#feedbackMessage", "A long passage test");
    await page.click("#feedbackSubmitButton");
    await page.waitForFunction(() => document.querySelector("#feedbackStatus").textContent.includes("sent"));
    assert.equal(feedbackRequests.length, 1);
    assert.equal(feedbackRequests[0].context.text.length, 20000);
    await page.keyboard.press("Escape");

    const importPending = new Promise(resolve => { importStarted = resolve; });
    let finishImport;
    holdImport = new Promise(resolve => { finishImport = resolve; });
    passage = ["עֲלֵיכֶם"];
    await importRef("Genesis 4:3");
    await importPending;
    await page.click("#feedbackOpenButton");
    assert.match(await page.locator("#feedbackContextSummary").innerText(), /Genesis 3:1/);
    finishImport();
    await page.waitForFunction(() => document.querySelector("#sefariaStatus").textContent.includes("Imported Genesis 4:3"));
    holdImport = importStarted = null;
    await page.fill("#feedbackMessage", "First draft");
    let finishSend;
    holdFeedback = new Promise(resolve => { finishSend = resolve; });
    const sending = page.waitForRequest("**/api/feedback");
    await page.click("#feedbackSubmitButton");
    await sending;
    await page.keyboard.press("Escape");
    await page.click("#feedbackOpenButton");
    assert.match(await page.locator("#feedbackContextSummary").innerText(), /Genesis 4:3/);
    await page.fill("#feedbackMessage", "Second draft");
    const delivered = page.waitForResponse("**/api/feedback");
    finishSend();
    await delivered;
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(feedbackRequests[1].context.ref, "Genesis 3:1");
    assert.equal(feedbackRequests[1].context.text, feedbackRequests[0].context.text);
    assert.equal(await page.inputValue("#feedbackMessage"), "Second draft");
    assert.equal(await page.locator("#feedbackStatus").textContent(), "");
    assert.equal(await page.isEnabled("#feedbackSubmitButton"), true);
    holdFeedback = null;
    await page.keyboard.press("Escape");

    audioAvailable = true;
    await editor.fill("שָׁלוֹם תּוֹרָה");
    await page.click("#speechButton");
    await page.getByRole("button", { name: "Stop audio", exact: true }).waitFor();
    await editor.evaluate(el => {
      el.focus();
      el.setSelectionRange(0, el.value.indexOf(" "));
      el.dispatchEvent(new Event("select"));
    });
    const download = page.waitForEvent("download");
    await page.click("#speechDownloadButton");
    await download;
    assert.deepEqual(await page.evaluate(() => window.players.map(player => player.paused)), [false, true]);
    await page.getByRole("button", { name: "Stop audio", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.players.map(player => player.paused)), [true, true]);

    const search = async term => {
      await page.fill("#sefariaQuery", term);
      await page.click("#sefariaSearchButton");
    };
    const genesisVerse = require("./fixtures/genesis/source.json").chapters[34].verses[21].hebrew;
    for (const [ref, lines, firstNumber] of [
      ["Genesis 35:22", [genesisVerse], 22],
      ["Pirkei Avot 2:4", ["שָׁלוֹם"], 4],
      ["Deuteronomy 6:4-9", Array(6).fill("שְׁמַע"), 4]
    ]) {
      passage = lines;
      if (ref === "Pirkei Avot 2:4") {
        await page.fill("#sefariaQuery", ref);
        await page.locator("#sefariaQuery").press("Enter");
      } else {
        await search(ref);
      }
      await page.waitForFunction(ref => document.querySelector("#sefariaStatus").textContent.startsWith("Imported " + ref + "."), ref);
      assert.equal(await page.locator("#hebrewInputLabel").textContent(), "Vocalized Hebrew — " + ref);
      assert.equal(await editor.inputValue(), lines.map((line, i) => (firstNumber + i) + ". " + line).join("\n"));
      assert.match(await output.textContent(), /[a-z]/i);
      assert.equal(await page.locator("#sefariaResults button").count(), 0);
      assert.ok(!fullTextQueries.includes(ref));
    }
    const searchPending = new Promise(resolve => { importStarted = resolve; });
    let finishSearch;
    holdImport = new Promise(resolve => { finishSearch = resolve; });
    await search("Genesis 35:23");
    await searchPending;
    await editor.fill("keep this edit");
    finishSearch();
    await page.waitForFunction(() => document.querySelector("#sefariaStatus").textContent.includes("edits were kept"));
    assert.equal(await editor.inputValue(), "keep this edit");
    holdImport = importStarted = null;
    await search("Siddur Demo, Morning, Prayer");
    await page.waitForFunction(() => document.querySelector("#sefariaStatus").textContent.startsWith("Imported Siddur Demo, Morning, Prayer."));
    assert.equal(await page.locator("#sefariaResults button").count(), 0);
    const importedPrayer = await editor.inputValue();
    await search("covenant");
    await page.getByRole("button", { name: "Import Exodus 2:24", exact: true }).waitFor();
    assert.equal(await page.locator("#sefariaResults .page-button").count(), 2);
    assert.equal(await editor.inputValue(), importedPrayer);
    await search("prayer 42");
    await page.getByRole("button", { name: "Import Deuteronomy 33:6", exact: true }).waitFor();
    assert.ok(fullTextQueries.includes("prayer 42"));
    assert.doesNotMatch(await page.locator("#sefariaStatus").textContent(), /trouble responding/);
    await search("Genesis");
    await page.getByRole("button", { name: "Browse sections in Genesis", exact: true }).click();
    assert.equal(await page.locator(".chapter-number-strip button").count(), 50);
    await search("Siddur Demo");
    await page.getByRole("button", { name: "Browse sections in Siddur Demo", exact: true }).click();
    const folder = page.getByRole("button", { name: "Browse sections in Siddur Demo, " + amida, exact: true });
    assert.equal(await folder.textContent(), amida);
    await folder.click();
    await page.getByRole("button", { name: "Import Siddur Demo, " + amida + ", Avot", exact: true }).waitFor();
    assert.deepEqual(await page.locator("#sefariaResults .page-button").allTextContents(), ["Avot", "Gevurot", "Kedusha"]);
    assert.deepEqual(await page.locator(".sefaria-breadcrumb-button").allTextContents(), ["Siddur Demo", amida]);
    await page.locator(".sefaria-breadcrumb-button").first().click();
    // Defer a result even beyond cancellation to check the stale-render guard.
    await page.evaluate(() => {
      const client = window.HebrewTransliteratorSefariaClient.SefariaClient.prototype;
      const validate = client.validateResult;
      client.validateResult = async function(result, options) {
        if (!result.ref.endsWith("Prayer")) return validate.call(this, result, options);
        await new Promise(resolve => { window.finishLookup = resolve; });
        return { ...result, valid: true, availability: "import" };
      };
    });
    await page.getByRole("button", { name: "Browse sections in Siddur Demo, Morning", exact: true }).click();
    await page.waitForFunction(() => Boolean(window.finishLookup));
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.evaluate(async () => {
      window.finishLookup();
      await new Promise(requestAnimationFrame);
    });
    assert.equal(await page.locator("#sefariaResults .folder-button").innerText(), "Siddur Demo");
    await editor.fill("יֱהֹוִ֤ה אֲדֹנָי֙");
    assert.equal(await output.textContent(), "Adonai Elohim");
    await editor.evaluate(el => {
      el.focus();
      el.setSelectionRange(el.value.indexOf(" ") + 1, el.value.length);
      el.dispatchEvent(new Event("select"));
    });
    const selectedNameDownload = page.waitForEvent("download");
    await page.click("#speechDownloadButton");
    await selectedNameDownload;
    assert.equal(audioRequests.at(-1).text, "אֱלֹהִים".normalize("NFC"));
    await editor.fill("יְהֹוָ֣ה ׀ יְהֹוָ֔ה");
    assert.equal((await output.textContent()).replace(/\s+/gu, " "), "Adonai Adonai");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
