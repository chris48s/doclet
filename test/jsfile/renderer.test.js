import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, render } from "../../src/js/jsfile/renderer.js";

const block = (overrides = {}) => ({
  description: "",
  tags: [],
  problems: [],
  ...overrides,
});

describe("escapeHtml", () => {
  test("escapes HTML special characters", () => {
    assert.equal(
      escapeHtml(`<a href="x" title='y'>&</a>`),
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  test("coerces non-strings", () => {
    assert.equal(escapeHtml(42), "42");
  });
});

describe("render", () => {
  test("reports when there are no entries", () => {
    assert.equal(render([]), "<p>No documentation comments found.</p>");
  });

  test("renders signature with modifiers and params", () => {
    const html = render([
      {
        block: block(),
        declaration: {
          kind: "function",
          name: "foo",
          params: ["a", "b"],
          async: true,
          generator: false,
          exported: true,
          default: false,
        },
      },
    ]);
    assert.match(html, /<span class="kind">export async function<\/span>/);
    assert.match(html, /<code>foo\(a, b\)<\/code>/);
  });

  test("renders export default and class extends", () => {
    const html = render([
      {
        block: block(),
        declaration: {
          kind: "class",
          name: "A",
          extends: "B",
          exported: true,
          default: true,
        },
      },
    ]);
    assert.match(html, /export default class/);
    assert.match(html, /<code>A extends B<\/code>/);
  });

  test("uses declarationKind for variables", () => {
    const html = render([
      {
        block: block(),
        declaration: { kind: "variable", name: "x", declarationKind: "const" },
      },
    ]);
    assert.match(html, /<span class="kind">const<\/span>/);
  });

  test("renders a heading with no declaration", () => {
    const html = render([{ block: block(), declaration: null }]);
    assert.match(html, /<section class="block" id="block">/);
    assert.match(html, /<a class="permalink" href="#block">#<\/a>/);
  });

  test("makes ids unique on collision", () => {
    const decl = { kind: "function", name: "foo", params: [] };
    const html = render([
      { block: block(), declaration: decl },
      { block: block(), declaration: decl },
    ]);
    assert.match(html, /id="foo"/);
    assert.match(html, /id="foo-2"/);
  });

  test("slugs unsafe characters in ids", () => {
    const html = render([
      { block: block(), declaration: { kind: "variable", name: "a b/c" } },
    ]);
    assert.match(html, /id="a-b-c"/);
  });

  test("escapes source-derived text", () => {
    const html = render([
      {
        block: block({
          description: "<script>alert(1)</script>",
          tags: [
            {
              tag: "param",
              type: "<T>",
              name: "x",
              description: "<b>",
              optional: false,
            },
          ],
        }),
        declaration: { kind: "function", name: "<img>", params: [] },
      },
    ]);
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img>"));
    assert.ok(!html.includes("<b>"));
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /\{&lt;T&gt;\}/);
  });

  test("renders tag details", () => {
    const html = render([
      {
        block: block({
          tags: [
            {
              tag: "param",
              type: "number",
              name: "n",
              optional: true,
              default: "1",
              description: "A number",
            },
          ],
        }),
        declaration: null,
      },
    ]);
    assert.match(html, /<span class="tag-name">param<\/span>/);
    assert.match(html, /<code class="tag-type">\{number\}<\/code>/);
    assert.match(html, /<code class="tag-id">n<\/code>/);
    assert.match(html, /<span class="tag-optional">optional<\/span>/);
    assert.match(html, /default: <code>1<\/code>/);
    assert.match(html, /<p>A number<\/p>/);
  });

  test("splits descriptions into paragraphs", () => {
    const html = render([
      {
        block: block({ description: "First\nline\n\nSecond" }),
        declaration: null,
      },
    ]);
    assert.match(html, /<p>First<br>line<\/p>\n<p>Second<\/p>/);
  });

  test("strips leading dash and whitespace from tag descriptions", () => {
    const html = render([
      {
        block: block({
          tags: [{ tag: "param", name: "x", description: " - \n First" }],
        }),
        declaration: null,
      },
    ]);
    assert.match(html, /<div class="tag-description"><p>First<\/p><\/div>/);
  });

  test("linkifies URLs without trailing punctuation", () => {
    const html = render([
      {
        block: block({ description: "See https://example.com/a?b=1&c=2." }),
        declaration: null,
      },
    ]);
    assert.match(
      html,
      /<a href="https:\/\/example.com\/a\?b=1&amp;c=2" rel="noopener noreferrer">https:\/\/example.com\/a\?b=1&amp;c=2<\/a>\.<\/p>/,
    );
  });

  test("does not linkify non-http schemes", () => {
    const html = render([
      {
        block: block({ description: "javascript:alert(1)" }),
        declaration: null,
      },
    ]);
    assert.ok(!html.includes("<a href"));
  });

  describe("markdown", () => {
    const md = (description, tags = []) =>
      render([{ block: block({ description, tags }), declaration: null }], {
        markdown: true,
      });

    test("does not render markdown by default", () => {
      const html = render([
        { block: block({ description: "**bold**" }), declaration: null },
      ]);
      assert.match(html, /<p>\*\*bold\*\*<\/p>/);
    });

    test("renders markdown descriptions", () => {
      const html = md("**bold** and [a link](https://example.com)\n\n- one");
      assert.match(html, /<strong>bold<\/strong>/);
      assert.match(html, /<a href="https:\/\/example.com">a link<\/a>/);
      assert.match(html, /<li>one<\/li>/);
    });

    test("renders markdown in tag descriptions and strips leading dash", () => {
      const html = md("", [
        { tag: "param", name: "x", description: "- some `code`" },
      ]);
      assert.match(html, /<code>code<\/code>/);
      assert.doesNotMatch(html, /<ul>/);
    });

    test("still linkifies tag names", () => {
      const html = md("", [
        { tag: "see", name: "https://example.com", description: "" },
      ]);
      assert.match(
        html,
        /<code class="tag-id"><a href="https:\/\/example.com"/,
      );
    });

    test("escapes raw HTML", () => {
      const html = md("<script>alert(1)</script> <img src=x onerror=y>");
      assert.ok(!html.includes("<script>"));
      assert.ok(!html.includes("<img"));
    });

    test("drops unsafe link targets", () => {
      const html = md("[x](javascript:alert(1)) ![y](data:text/html,z)");
      assert.ok(!html.includes("javascript:"));
      assert.ok(!html.includes("data:"));
    });
  });

  test("renders problems", () => {
    const html = render([
      {
        block: block({ problems: [{ line: 3, message: "bad <tag>" }] }),
        declaration: null,
      },
    ]);
    assert.match(html, /<li>Line 3: bad &lt;tag&gt;<\/li>/);
  });
});
