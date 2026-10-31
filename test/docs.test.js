import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { main } from "../jsdoc/docs.js";

function makeEnv({ search = "", hash = "", fetch } = {}) {
  const ids = ["status", "error", "output", "source", "title"];
  const elements = Object.fromEntries(
    ids.map((id) => [id, { hidden: undefined, textContent: "", innerHTML: "" }]),
  );
  const document = { getElementById: (id) => elements[id] ?? null };
  return { env: { document, location: { search, hash }, fetch }, elements };
}

const respond = (body, { status = 200, statusText = "OK" } = {}) => async () => ({
  status,
  statusText,
  text: async () => body,
});

const SOURCE = `/**
 * Adds numbers.
 * @param {number} a - First
 * @returns {number} The sum
 */
export function add(a) {}
`;

const urlParam = (url) => `?url=${encodeURIComponent(url)}`;

describe("main", () => {
  test("renders documentation for the requested url", async () => {
    let requested;
    const { env, elements } = makeEnv({
      search: urlParam("https://example.com/src/add.js"),
      fetch: async (url) => {
        requested = url;
        return respond(SOURCE)();
      },
    });

    await main(env);

    assert.equal(requested.href, "https://example.com/src/add.js");
    assert.equal(elements.title.textContent, "add.js");
    assert.match(elements.source.innerHTML, /<a href="https:\/\/example.com\/src\/add.js"/);
    assert.match(elements.output.innerHTML, /export function<\/span> <code>add\(a\)<\/code>/);
    assert.match(elements.output.innerHTML, /<span class="tag-name">param<\/span>/);
    assert.equal(elements.status.hidden, true);
    assert.equal(elements.output.hidden, false);
    assert.equal(elements.error.hidden, undefined);
  });

  test("does not treat @returns text as a name", async () => {
    const { env, elements } = makeEnv({
      search: urlParam("https://example.com/add.js"),
      fetch: respond(SOURCE),
    });
    await main(env);
    assert.doesNotMatch(elements.output.innerHTML, /<code class="tag-id">The<\/code>/);
    assert.match(elements.output.innerHTML, /<p>The sum<\/p>/);
  });

  test("falls back to the default title when the path has no file name", async () => {
    const { env, elements } = makeEnv({
      search: urlParam("https://example.com/"),
      fetch: respond(""),
    });
    await main(env);
    assert.equal(elements.title.textContent, "Doclet");
    assert.match(elements.output.innerHTML, /No documentation comments found/);
  });

  test("scrolls to the element named by the location hash", async () => {
    const { env, elements } = makeEnv({
      search: urlParam("https://example.com/add.js"),
      hash: "#my%20id",
      fetch: respond(SOURCE),
    });
    const scrolled = [];
    env.document.getElementById = (id) => {
      if (id === "my id") return { scrollIntoView: () => scrolled.push(id) };
      return elements[id] ?? null;
    };
    await main(env);
    assert.deepEqual(scrolled, ["my id"]);
  });

  test("tolerates a hash that matches no element", async () => {
    const { env, elements } = makeEnv({
      search: urlParam("https://example.com/add.js"),
      hash: "#nope",
      fetch: respond(SOURCE),
    });
    await main(env);
    assert.equal(elements.error.hidden, undefined);
  });

  describe("errors", () => {
    async function expectError(options, pattern) {
      const { env, elements } = makeEnv(options);
      await main(env);
      assert.match(elements.error.textContent, pattern);
      assert.match(elements.error.textContent, /^Error: /);
      assert.equal(elements.error.hidden, false);
      assert.equal(elements.status.hidden, true);
      assert.equal(elements.output.hidden, true);
    }

    test("missing url parameter", async () => {
      await expectError({ search: "", fetch: respond("") }, /Missing required query parameter 'url'/);
    });

    test("invalid url", async () => {
      await expectError({ search: urlParam("not a url"), fetch: respond("") }, /'not a url' is not a valid URL/);
    });

    test("unsupported protocol", async () => {
      await expectError(
        { search: urlParam("file:///etc/passwd"), fetch: respond("") },
        /Unsupported URL protocol 'file:'/,
      );
    });

    test("does not fetch when the url is rejected", async () => {
      let called = false;
      await expectError(
        {
          search: urlParam("ftp://example.com/a.js"),
          fetch: async () => {
            called = true;
          },
        },
        /Unsupported URL protocol/,
      );
      assert.equal(called, false);
    });

    test("network failure", async () => {
      await expectError(
        {
          search: urlParam("https://example.com/a.js"),
          fetch: async () => {
            throw new TypeError("Failed to fetch");
          },
        },
        /Could not fetch https:\/\/example.com\/a.js .*CORS.*Failed to fetch/,
      );
    });

    test("non-200 response", async () => {
      await expectError(
        {
          search: urlParam("https://example.com/a.js"),
          fetch: respond("", { status: 404, statusText: "Not Found" }),
        },
        /Fetching https:\/\/example.com\/a.js failed: 404 Not Found/,
      );
    });

    test("unreadable response body", async () => {
      await expectError(
        {
          search: urlParam("https://example.com/a.js"),
          fetch: async () => ({
            status: 200,
            text: async () => {
              throw new Error("stream broke");
            },
          }),
        },
        /Could not read response body from https:\/\/example.com\/a.js: stream broke/,
      );
    });

    test("source that is not JavaScript", async () => {
      await expectError(
        { search: urlParam("https://example.com/a.js"), fetch: respond("function (") },
        /Could not parse file as JavaScript/,
      );
    });
  });
});
