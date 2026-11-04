const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function getTargetUrl(search) {
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

export function showError(document, err) {
  document.getElementById("status").hidden = true;
  document.getElementById("output").hidden = true;
  const errorEl = document.getElementById("error");
  errorEl.textContent = `Error: ${err.message}`;
  errorEl.hidden = false;
}
