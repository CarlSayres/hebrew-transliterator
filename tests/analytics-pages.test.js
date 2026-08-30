const test = require("node:test");
const assert = require("node:assert/strict");
const pages = require("../site/analytics-pages");

test("turns a Sefaria hierarchy into a virtual page path", () => {
  assert.deepEqual(
    pages.sefariaPage("Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Modeh Ani"),
    {
      path: "/Sefaria/Siddur%20Ashkenaz/Weekday/Shacharit/Preparatory%20Prayers/Modeh%20Ani",
      title: "Sefaria: Siddur Ashkenaz › Weekday › Shacharit › Preparatory Prayers › Modeh Ani",
      eventName: "sefaria_reference_viewed"
    }
  );
});

test("keeps each audio action in a distinct page hierarchy", () => {
  const reference = "Genesis, 1:1";
  assert.equal(pages.audioPage("Generated", reference).path, "/Audio/Generated/Genesis/1%3A1");
  assert.equal(pages.audioPage("Listened", reference).path, "/Audio/Listened/Genesis/1%3A1");
  assert.equal(pages.audioPage("Downloaded", reference).path, "/Audio/Downloaded/Genesis/1%3A1");
});

test("never puts arbitrary Hebrew text into a virtual page", () => {
  assert.equal(pages.audioPage("Generated", "").path, "/Audio/Generated/Arbitrary%20Hebrew");
  assert.equal(pages.audioPage("Played", "anything"), null);
});
