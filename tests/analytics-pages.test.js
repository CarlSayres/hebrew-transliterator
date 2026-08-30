const test = require("node:test");
const assert = require("node:assert/strict");
const pages = require("../site/analytics-pages");

test("turns a Sefaria hierarchy into a virtual page path", () => {
  assert.deepEqual(
    pages.sefariaPage("Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Modeh Ani"),
    {
      path: "/Sefaria/Siddur_Ashkenaz/Weekday/Shacharit/Preparatory_Prayers/Modeh_Ani",
      title: "Sefaria: Siddur Ashkenaz › Weekday › Shacharit › Preparatory Prayers › Modeh Ani",
      eventName: "sefaria_reference_viewed"
    }
  );
});

test("keeps each audio action in a distinct page hierarchy", () => {
  const reference = "Genesis, 1:1";
  assert.equal(pages.audioPage("Generated", reference).path, "/Audio/Generated/Genesis/1_1");
  assert.equal(pages.audioPage("Listened", reference).path, "/Audio/Listened/Genesis/1_1");
  assert.equal(pages.audioPage("Downloaded", reference).path, "/Audio/Downloaded/Genesis/1_1");
});

test("uses readable URL-safe characters instead of percent encoding", () => {
  const page = pages.sefariaPage("Barukh She'amar, Part 1: Opening");
  assert.equal(page.path, "/Sefaria/Barukh_She_amar/Part_1_Opening");
  assert.doesNotMatch(page.path, /%[0-9A-F]{2}/i);
});

test("never puts arbitrary Hebrew text into a virtual page", () => {
  assert.equal(pages.audioPage("Generated", "").path, "/Audio/Generated/Arbitrary_Hebrew");
  assert.equal(pages.audioPage("Played", "anything"), null);
});
