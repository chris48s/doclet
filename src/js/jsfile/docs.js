import { parse, tokenizers } from "comment-parser";
import { findDocumentedDeclarations } from "./declarations.js";
import { render } from "./renderer.js";
import { escapeHtml, getTargetUrl, showError } from "../helpers.js";

async function fetchSource(url, fetch) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    // fetch() rejects on network failure or CORS rejection
    throw new Error(
      `Could not fetch ${url} (network error or blocked by CORS): ${err.message}`,
      { cause: err },
    );
  }

  if (response.status !== 200) {
    throw new Error(
      `Fetching ${url} failed: ${response.status} ${response.statusText}`.trim(),
    );
  }

  try {
    return await response.text();
  } catch (err) {
    throw new Error(
      `Could not read response body from ${url}: ${err.message}`,
      { cause: err },
    );
  }
}

const DESCRIPTION_ONLY_TAGS = new Set([
  "@returns",
  "@return",
  "@file",
  "@fileoverview",
  "@overview",
]);
const tokenizeName = tokenizers.name();

const parserOptions = {
  tokenizers: [
    tokenizers.tag(),
    tokenizers.type("compact"),
    // These tags have no name, so the rest of the line is the description
    (spec) =>
      DESCRIPTION_ONLY_TAGS.has(`@${spec.tag}`) ? spec : tokenizeName(spec),
    tokenizers.description("compact"),
  ],
};

function parseSource(source) {
  let found;
  try {
    found = findDocumentedDeclarations(source);
  } catch (err) {
    throw new Error(`Could not parse file as JavaScript: ${err.message}`, {
      cause: err,
    });
  }

  try {
    return found.flatMap(({ comment, declaration }) =>
      parse(comment, parserOptions).map((block) => ({ block, declaration })),
    );
  } catch (err) {
    throw new Error(`Could not parse doc comment: ${err.message}`, {
      cause: err,
    });
  }
}

async function load(env) {
  const { document, location, fetch } = env;
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");
  const sourceEl = document.getElementById("source");
  const titleEl = document.getElementById("title");

  const url = getTargetUrl(location.search);
  titleEl.textContent = url.pathname.split("/").pop() || "Doclet";
  const safeUrl = escapeHtml(url.href);
  sourceEl.innerHTML = `Source: <a href="${safeUrl}" rel="noopener noreferrer">${safeUrl}</a>`;

  const source = await fetchSource(url, fetch);
  const entries = parseSource(source);

  const markdown = new URLSearchParams(location.search).get("md") === "true";
  outputEl.innerHTML = render(entries, { markdown });
  statusEl.hidden = true;
  outputEl.hidden = false;

  if (location.hash) {
    document
      .getElementById(decodeURIComponent(location.hash.slice(1)))
      ?.scrollIntoView();
  }
}

/**
 * Fetch and render the file named by the `url` query parameter into the page.
 * Never rejects; failures are shown in the page's error element.
 */
export async function main(env) {
  try {
    await load(env);
  } catch (err) {
    showError(env.document, err);
  }
}
