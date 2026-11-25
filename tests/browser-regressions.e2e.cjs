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
    const errors = [];
    let passage = [];
    let holdImport;
    let importStarted;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "www.sefaria.org") {
        const ref = decodeURIComponent(url.pathname.split("/").at(-1));
        if (url.pathname.startsWith("/api/ref/")) {
          return route.fulfill({ json: { is_ref: true, normalized: ref, depth: 2, start_indexes: [1], url_ref: ref } });
        }
        if (importStarted) importStarted();
        if (holdImport) await holdImport;
        return route.fulfill({ json: { ref, categories: ["Tanakh"], versions: [{ language: "he", text: passage, versionSource: "https://example.org/edition" }] } });
      }
      if (url.pathname === "/api/feedback") {
        feedbackRequests.push(route.request().postDataJSON());
        return route.fulfill({ status: 204 });
      }
      if (url.pathname === "/api/audio") {
        audioRequests.push(route.request().postDataJSON());
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
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
