import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, getTargetUrl, showError } from "../src/js/helpers.js";

describe("escapeHtml", () => {
  test("escapes HTML special characters", () => {
    assert.equal(
      escapeHtml(`<a href="x">'&'</a>`),
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("getTargetUrl", () => {
  test("returns the parsed url", () => {
    const url = getTargetUrl("?url=https%3A%2F%2Fexample.com%2Fa.js");
    assert.equal(url.href, "https://example.com/a.js");
  });

  test("rejects a missing parameter", () => {
    assert.throws(
      () => getTargetUrl(""),
      /Missing required query parameter 'url'/,
    );
  });

  test("rejects an invalid url", () => {
    assert.throws(
      () => getTargetUrl("?url=not%20a%20url"),
      /'not a url' is not a valid URL/,
    );
  });

  test("rejects an unsupported protocol", () => {
    assert.throws(
      () => getTargetUrl("?url=file%3A%2F%2F%2Fetc%2Fpasswd"),
      /Unsupported URL protocol 'file:'/,
    );
  });
});

describe("showError", () => {
  test("hides status and output and shows the message", () => {
    const elements = {
      status: { hidden: undefined },
      output: { hidden: undefined },
      error: { hidden: true, textContent: "" },
    };
    showError({ getElementById: (id) => elements[id] }, new Error("boom"));
    assert.equal(elements.status.hidden, true);
    assert.equal(elements.output.hidden, true);
    assert.equal(elements.error.hidden, false);
    assert.equal(elements.error.textContent, "Error: boom");
  });
});
