const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function renderDescription(description) {
  return description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function renderProblems(problems) {
  if (!problems || problems.length === 0) {
    return "";
  }
  const items = problems
    .map((p) => `<li>Line ${escapeHtml(p.line)}: ${escapeHtml(p.message)}</li>`)
    .join("");
  return `<ul class="problems">${items}</ul>`;
}

function renderTag(tag) {
  const parts = [`<span class="tag-name">@${escapeHtml(tag.tag)}</span>`];

  if (tag.type) {
    parts.push(`<code class="tag-type">{${escapeHtml(tag.type)}}</code>`);
  }
  if (tag.name) {
    parts.push(`<code class="tag-id">${escapeHtml(tag.name)}</code>`);
  }
  if (tag.optional) {
    parts.push('<span class="tag-optional">optional</span>');
  }
  if (tag.default !== undefined) {
    parts.push(`<span class="tag-default">default: <code>${escapeHtml(tag.default)}</code></span>`);
  }

  const description = tag.description
    ? `<div class="tag-description">${renderDescription(tag.description)}</div>`
    : "";

  return `<li class="tag">${parts.join(" ")}${description}${renderProblems(tag.problems)}</li>`;
}

function renderBlock(block) {
  const description = block.description
    ? `<div class="description">${renderDescription(block.description)}</div>`
    : "";
  const tags = block.tags.length
    ? `<ul class="tags">${block.tags.map(renderTag).join("\n")}</ul>`
    : "";
  const source = block.source.map((line) => line.source).join("\n");

  return `<section class="block">
${description}
${tags}
${renderProblems(block.problems)}
<details><summary>Source</summary><pre><code>${escapeHtml(source)}</code></pre></details>
</section>`;
}

/**
 * Render the array of blocks returned by comment-parser's parse() to an HTML string.
 * All source-derived text is escaped.
 */
export function render(blocks) {
  if (blocks.length === 0) {
    return "<p>No documentation comments found.</p>";
  }
  return blocks.map(renderBlock).join("\n");
}
