import { Marked } from "marked";
import { escapeHtml } from "../helpers.js";

export { escapeHtml };

// Matches http(s) URLs, excluding trailing punctuation.
const URL_PATTERN = /https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]}]/g;

// Escapes text and wraps http(s) URLs in anchors; only unescaped pieces are split, so output stays safe.
function linkify(text) {
  let result = "";
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    result += escapeHtml(text.slice(last, match.index));
    const safeUrl = escapeHtml(url);
    result += `<a href="${safeUrl}" rel="noopener noreferrer">${safeUrl}</a>`;
    last = match.index + url.length;
  }
  return result + escapeHtml(text.slice(last));
}

const SAFE_HREF = /^(https?:|mailto:|#|\/|\.)/i;

// Raw HTML is escaped and unsafe link/image targets are dropped, since comments are untrusted input.
const marked = new Marked({
  renderer: {
    html: ({ text }) => escapeHtml(text),
  },
  walkTokens(token) {
    if (
      (token.type === "link" || token.type === "image") &&
      !SAFE_HREF.test(token.href.trim())
    ) {
      token.href = "";
    }
  },
});

// `stripDash` removes the "- " separator that follows a tag name.
function renderDescription(description, { markdown, stripDash }) {
  if (stripDash) {
    description = description.replace(/^[-\s]+/, "");
  }
  if (markdown) {
    return marked.parse(description, { async: false }).trim();
  }
  return description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${linkify(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function renderProblems(problems) {
  if (!problems || problems.length === 0) {
    return "";
  }
  const items = problems
    .map((p) => `<li>Line ${escapeHtml(p.line)}: ${escapeHtml(p.message)}</li>`)
    .join("");
  return `<h3 class="problems">Problems</h3><ul class="problems">${items}</ul>`;
}

function renderTag(tag, markdown) {
  const parts = [`<span class="tag-name">${escapeHtml(tag.tag)}</span>`];

  if (tag.type) {
    parts.push(`<code class="tag-type">{${escapeHtml(tag.type)}}</code>`);
  }
  if (tag.name) {
    parts.push(`<code class="tag-id">${linkify(tag.name)}</code>`);
  }
  if (tag.optional) {
    parts.push('<span class="tag-optional">optional</span>');
  }
  if (tag.default !== undefined) {
    parts.push(
      `<span class="tag-default">default: <code>${escapeHtml(tag.default)}</code></span>`,
    );
  }

  const description = tag.description
    ? `<div class="tag-description">${renderDescription(tag.description, { markdown, stripDash: true })}</div>`
    : "";

  return `<li class="tag">${parts.join(" ")}${description}${renderProblems(tag.problems)}</li>`;
}

// Slugs the declaration name and appends -2, -3, ... on collision so every id on the page is unique.
function makeId(declaration, used) {
  const base =
    (declaration?.name ?? "")
      .replace(/[^\w$.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "block";
  let id = base;
  for (let n = 2; used.has(id); n++) {
    id = `${base}-${n}`;
  }
  used.add(id);
  return id;
}

function renderHeading(declaration, id) {
  if (!declaration) {
    return `<h2 class="signature"><a class="permalink" href="#${escapeHtml(id)}">#</a></h2>`;
  }

  const modifiers = [];
  if (declaration.exported)
    modifiers.push(declaration.default ? "export default" : "export");
  if (declaration.static) modifiers.push("static");
  if (declaration.async) modifiers.push("async");
  if (declaration.generator) modifiers.push("generator");

  const keyword =
    declaration.kind === "variable"
      ? (declaration.declarationKind ?? "variable")
      : declaration.kind;
  const name = declaration.name ?? "(anonymous)";
  const params = declaration.params ? `(${declaration.params.join(", ")})` : "";
  const extendsClause = declaration.extends
    ? ` extends ${declaration.extends}`
    : "";
  const prefix = [...modifiers, keyword].join(" ");

  return `<h2 class="signature"><span class="kind">${escapeHtml(prefix)}</span> <code>${escapeHtml(name + params + extendsClause)}</code> <a class="permalink" href="#${escapeHtml(id)}" title="Permalink">#</a></h2>`;
}

const MEMBER_KINDS = new Set([
  "constructor",
  "method",
  "property",
  "get",
  "set",
]);

function renderBlock({ block, declaration }, used, markdown) {
  const id = makeId(declaration, used);
  const blockClass = MEMBER_KINDS.has(declaration?.kind)
    ? "block member"
    : "block";
  const description = block.description
    ? `<div class="description">${renderDescription(block.description, { markdown, stripDash: false })}</div>`
    : "";
  const tags = block.tags.length
    ? `<ul class="tags">${block.tags.map((t) => renderTag(t, markdown)).join("\n")}</ul>`
    : "";

  return `<section class="${blockClass}" id="${escapeHtml(id)}">
${renderHeading(declaration, id)}
${description}
${tags}
${renderProblems(block.problems)}
</section>`;
}

/**
 * Render [{ block, declaration }] to an HTML string, where `block` is a comment-parser
 * Block and `declaration` is from declarations.js (or null). All source-derived text is escaped.
 * With `markdown`, descriptions are rendered as markdown instead of linkified plain text.
 */
export function render(entries, { markdown = false } = {}) {
  if (entries.length === 0) {
    return "<p>No documentation comments found.</p>";
  }
  const used = new Set();
  return entries.map((entry) => renderBlock(entry, used, markdown)).join("\n");
}
