export function parseRepoUrl(repoUrl) {
  const url = new URL(repoUrl);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.hostname !== "github.com" || parts.length < 2) {
    throw new Error("Invalid GitHub repository URL");
  }

  const [owner, repo] = parts;
  return { owner, repo: repo.replace(/\.git$/, "") };
}

export async function getJavaScriptFiles(repoUrl) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

  // Helper for API requests
  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  // Get repository metadata and default branch
  const repoData = await fetchJson(baseUrl);
  const defaultBranch = repoData.default_branch;

  // Get recursive repository tree
  const treeData = await fetchJson(
    `${baseUrl}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
  );

  // Check whether GitHub returned the complete tree
  if (treeData.truncated) {
    throw new Error(
      "Repository tree was truncated by GitHub; results may be incomplete.",
    );
  }

  const files = treeData.tree
    .filter(
      (item) => item.type === "blob" && /\.(js|mjs|cjs)$/i.test(item.path),
    )
    .map((item) => item.path);
  return { defaultBranch, files };
}
