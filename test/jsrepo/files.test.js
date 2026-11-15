import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getJavaScriptFiles } from "../../src/js/jsrepo/files.js";

afterEach(() => mock.restoreAll());

function stubGitHub(tree, { defaultBranch = "main", truncated = false } = {}) {
  return mock.method(globalThis, "fetch", async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("/git/trees/")
        ? { truncated, tree }
        : { default_branch: defaultBranch },
  }));
}

describe("getJavaScriptFiles", () => {
  test("returns the default branch and .js, .mjs and .cjs blobs", async () => {
    const fetch = stubGitHub(
      [
        { type: "blob", path: "a.js" },
        { type: "blob", path: "b.MJS" },
        { type: "blob", path: "src/c.cjs" },
        { type: "blob", path: "d.json" },
        { type: "blob", path: "e.jsx" },
        { type: "tree", path: "dir.js" },
      ],
      { defaultBranch: "dev/x" },
    );

    const result = await getJavaScriptFiles("https://github.com/owner/repo");

    assert.deepEqual(result, {
      defaultBranch: "dev/x",
      files: ["a.js", "b.MJS", "src/c.cjs"],
    });
    assert.equal(fetch.mock.callCount(), 2);
    assert.equal(
      fetch.mock.calls[1].arguments[0],
      "https://api.github.com/repos/owner/repo/git/trees/dev%2Fx?recursive=1",
    );
  });

  test("rejects a truncated tree", async () => {
    stubGitHub([], { truncated: true });
    await assert.rejects(
      getJavaScriptFiles("https://github.com/owner/repo"),
      /truncated/,
    );
  });

  test("rejects a non-GitHub url", async () => {
    await assert.rejects(
      getJavaScriptFiles("https://example.com/owner/repo"),
      /Invalid GitHub repository URL/,
    );
  });

  test("ignores .test.js, .test.mjs, .test.cjs, .spec.js, .spec.mjs, and .spec.cjs files", async () => {
    stubGitHub([
      { type: "blob", path: "main.js" },
      { type: "blob", path: "utils.mjs" },
      { type: "blob", path: "config.cjs" },
      { type: "blob", path: "main.test.js" },
      { type: "blob", path: "utils.test.mjs" },
      { type: "blob", path: "config.test.cjs" },
      { type: "blob", path: "main.spec.js" },
      { type: "blob", path: "utils.spec.mjs" },
      { type: "blob", path: "config.spec.cjs" },
      { type: "blob", path: "src/helpers.js" },
      { type: "blob", path: "src/helpers.test.js" },
      { type: "blob", path: "src/helpers.spec.mjs" },
      { type: "blob", path: "test/runner.js" },
      { type: "blob", path: "test/runner.spec.cjs" },
    ]);

    const result = await getJavaScriptFiles("https://github.com/owner/repo");

    assert.deepEqual(result, {
      defaultBranch: "main",
      files: [
        "main.js",
        "utils.mjs",
        "config.cjs",
        "src/helpers.js",
        "test/runner.js",
      ],
    });
  });
});
