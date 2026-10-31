import { parse, tokenizers } from "comment-parser";
import { findDocumentedDeclarations } from "./declarations.js";
import { render, escapeHtml } from "./renderer.js";

function getTargetUrl(search) {
  const raw = new URLSearchParams(search).get("url");
  if (!raw) {
    throw new Error("Missing required query parameter 'url'.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`'${raw}' is not a valid URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `Unsupported URL protocol '${url.protocol}'. Use http or https.`,
    );
  }
  return url;
}

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

const RETURN_TAGS = new Set(["@returns", "@return"]);
const tokenizeName = tokenizers.name();

const parserOptions = {
  tokenizers: [
    tokenizers.tag(),
    tokenizers.type("compact"),
    // Return values have no name, so the rest of the line is the description
    (spec) => (RETURN_TAGS.has(`@${spec.tag}`) ? spec : tokenizeName(spec)),
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

  outputEl.innerHTML = render(entries);
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
    const { document } = env;
    document.getElementById("status").hidden = true;
    document.getElementById("output").hidden = true;
    const errorEl = document.getElementById("error");
    errorEl.textContent = `Error: ${err.message}`;
    errorEl.hidden = false;
  }
}
