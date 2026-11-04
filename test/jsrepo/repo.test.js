import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { main, sortFiles, renderFileList } from "../../src/js/jsrepo/repo.js";

afterEach(() => mock.restoreAll());

describe("sortFiles", () => {
  test("keeps root files together before directories", () => {
    assert.deepEqual(sortFiles(["abc/index.js", "def.js", "abc.js"]), [
      "abc.js",
      "def.js",
      "abc/index.js",
    ]);
  });

  test("groups files by directory", () => {
    assert.deepEqual(
      sortFiles(["a/b/z.js", "a-b/x.js", "a/y.js", "a/b/c/w.js", "a/x.js"]),
      ["a/x.js", "a/y.js", "a/b/z.js", "a/b/c/w.js", "a-b/x.js"],
    );
  });

  test("does not mutate the input", () => {
    const input = ["b/a.js", "a.js"];
    sortFiles(input);
    assert.deepEqual(input, ["b/a.js", "a.js"]);
  });
});

describe("renderFileList", () => {
  const repoUrl = "https://github.com/owner/repo.git";
  const defaultBranch = "main";
  const rawUrl = (path, branch = defaultBranch) =>
    encodeURIComponent(
      `https://raw.githubusercontent.com/owner/repo/${branch}/${path}`,
    );

  test("renders a link per file", () => {
    const html = renderFileList(["a.js", "src/b.js"], {
      repoUrl,
      defaultBranch,
      markdown: null,
    });
    assert.equal(
      html,
      `<ul><li><a href="../jsfile/?url=${rawUrl("a.js")}">a.js</a></li>` +
        `<li><a href="../jsfile/?url=${rawUrl("src/b.js")}">src/b.js</a></li></ul>`,
    );
  });

  test("passes the md parameter through", () => {
    const html = renderFileList(["a.js"], {
      repoUrl,
      defaultBranch,
      markdown: "true",
    });
    assert.match(html, /a\.js&amp;md=true"/);
  });

  test("uses the default branch in the raw url", () => {
    const html = renderFileList(["a.js"], {
      repoUrl,
      defaultBranch: "feature/x y",
      markdown: null,
    });
    assert.ok(html.includes(rawUrl("a.js", "feature/x%20y")));
  });

  test("encodes and escapes unusual file names", () => {
    const html = renderFileList(["a b/<c>.js"], {
      repoUrl,
      defaultBranch,
      markdown: null,
    });
    assert.ok(html.includes(rawUrl("a%20b/%3Cc%3E.js")));
    assert.ok(html.includes("&lt;c&gt;.js</a>"));
    assert.ok(!html.includes("<c>"));
  });

  test("renders an empty list", () => {
    assert.equal(
      renderFileList([], { repoUrl, defaultBranch, markdown: null }),
      "<ul></ul>",
    );
  });
});

function makeEnv(search) {
  const ids = ["status", "error", "output", "source", "title"];
  const elements = Object.fromEntries(
    ids.map((id) => [
      id,
      { hidden: undefined, textContent: "", innerHTML: "" },
    ]),
  );
  const document = { getElementById: (id) => elements[id] ?? null };
  return { env: { document, location: { search } }, elements };
}

function stubGitHub(paths) {
  mock.method(globalThis, "fetch", async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("/git/trees/")
        ? {
            truncated: false,
            tree: paths.map((path) => ({ type: "blob", path })),
          }
        : { default_branch: "main" },
  }));
}

const repoParam = (url) => `?url=${encodeURIComponent(url)}`;

describe("main", () => {
  test("renders a sorted list of files", async () => {
    stubGitHub(["abc/index.js", "def.mjs", "abc.cjs", "README.md"]);
    const { env, elements } = makeEnv(
      `${repoParam("https://github.com/owner/repo")}&md=true`,
    );
    await main(env);

    assert.equal(elements.title.textContent, "owner/repo");
    assert.match(
      elements.source.innerHTML,
      /<a href="https:\/\/github.com\/owner\/repo"/,
    );
    const names = [
      ...elements.output.innerHTML.matchAll(/>([^<]+\.[cm]?js)<\/a>/g),
    ].map((m) => m[1]);
    assert.deepEqual(names, ["abc.cjs", "def.mjs", "abc/index.js"]);
    assert.match(
      elements.output.innerHTML,
      /raw\.githubusercontent\.com%2Fowner%2Frepo%2Fmain%2F/,
    );
    assert.match(elements.output.innerHTML, /&amp;md=true"/);
    assert.equal(elements.status.hidden, true);
    assert.equal(elements.output.hidden, false);
    assert.equal(elements.error.hidden, undefined);
  });

  test("omits md when not provided", async () => {
    stubGitHub(["a.js"]);
    const { env, elements } = makeEnv(
      repoParam("https://github.com/owner/repo"),
    );
    await main(env);
    assert.doesNotMatch(elements.output.innerHTML, /md=/);
  });

  describe("errors", () => {
    async function expectError(search, pattern) {
      const { env, elements } = makeEnv(search);
      await main(env);
      assert.match(elements.error.textContent, pattern);
      assert.match(elements.error.textContent, /^Error: /);
      assert.equal(elements.error.hidden, false);
      assert.equal(elements.status.hidden, true);
      assert.equal(elements.output.hidden, true);
    }

    test("missing url parameter", async () => {
      await expectError("", /Missing required query parameter 'url'/);
    });

    test("invalid url", async () => {
      await expectError(
        repoParam("not a url"),
        /'not a url' is not a valid URL/,
      );
    });

    test("unsupported protocol", async () => {
      await expectError(
        repoParam("ftp://github.com/owner/repo"),
        /Unsupported URL protocol 'ftp:'/,
      );
    });

    test("non-GitHub url", async () => {
      await expectError(
        repoParam("https://example.com/owner/repo"),
        /Invalid GitHub repository URL/,
      );
    });

    test("GitHub API failure", async () => {
      mock.method(globalThis, "fetch", async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }));
      await expectError(
        repoParam("https://github.com/owner/missing"),
        /GitHub API error: 404 Not Found/,
      );
    });
  });
});
