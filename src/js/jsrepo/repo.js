import { escapeHtml, getTargetUrl, showError } from "../helpers.js";
import { getJavaScriptFiles, parseRepoUrl } from "./files.js";

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function compareDirs(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const result = compare(a[i], b[i]);
    if (result !== 0) return result;
  }
  return a.length - b.length;
}

// Groups files by directory: root files first, then each directory's files together.
export function sortFiles(files) {
  const split = (path) => {
    const parts = path.split("/");
    return { dirs: parts.slice(0, -1), name: parts.at(-1) };
  };
  return [...files].sort((a, b) => {
    const x = split(a);
    const y = split(b);
    return compareDirs(x.dirs, y.dirs) || compare(x.name, y.name);
  });
}

const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

export function renderFileList(files, { repoUrl, defaultBranch, markdown }) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${encodePath(defaultBranch)}/`;
  const suffix = markdown === null ? "" : `&md=${encodeURIComponent(markdown)}`;
  const items = files.map((file) => {
    const rawUrl = rawBase + encodePath(file);
    const href = `../jsfile/?url=${encodeURIComponent(rawUrl)}${suffix}`;
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(file)}</a></li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

async function load(env) {
  const { document, location } = env;
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");
  const sourceEl = document.getElementById("source");
  const titleEl = document.getElementById("title");

  const url = getTargetUrl(location.search);
  const { owner, repo } = parseRepoUrl(url);
  titleEl.textContent = `${owner}/${repo}`;
  const safeUrl = escapeHtml(url.href);
  sourceEl.innerHTML = `Source: <a href="${safeUrl}" rel="noopener noreferrer">${safeUrl}</a>`;

  const { defaultBranch, files } = await getJavaScriptFiles(url.href);
  const markdown = new URLSearchParams(location.search).get("md");
  outputEl.innerHTML = renderFileList(sortFiles(files), {
    repoUrl: url.href,
    defaultBranch,
    markdown,
  });
  statusEl.hidden = true;
  outputEl.hidden = false;
}

/**
 * List the JavaScript files in the repo named by the `url` query parameter.
 * Never rejects; failures are shown in the page's error element.
 */
export async function main(env) {
  try {
    await load(env);
  } catch (err) {
    showError(env.document, err);
  }
}
