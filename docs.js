import { parse } from "./node_modules/comment-parser/es6/index.js";
import { render } from "./renderer.js";

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const outputEl = document.getElementById("output");
const sourceEl = document.getElementById("source");

function showError(message) {
  statusEl.hidden = true;
  outputEl.hidden = true;
  errorEl.textContent = `Error: ${message}`;
  errorEl.hidden = false;
}

function getTargetUrl() {
  const raw = new URLSearchParams(window.location.search).get("url");
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
    throw new Error(`Unsupported URL protocol '${url.protocol}'. Use http or https.`);
  }
  return url;
}

async function fetchSource(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    // fetch() rejects on network failure or CORS rejection
    throw new Error(
      `Could not fetch ${url} (network error or blocked by CORS): ${err.message}`,
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
    throw new Error(`Could not read response body from ${url}: ${err.message}`);
  }
}

function parseSource(source) {
  try {
    return parse(source);
  } catch (err) {
    throw new Error(`Could not parse file: ${err.message}`);
  }
}

async function main() {
  const url = getTargetUrl();
  sourceEl.textContent = `Source: ${url}`;

  const source = await fetchSource(url);
  const blocks = parseSource(source);

  outputEl.innerHTML = render(blocks);
  statusEl.hidden = true;
  outputEl.hidden = false;
}

main().catch((err) => showError(err.message));
