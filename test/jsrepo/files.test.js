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
});
