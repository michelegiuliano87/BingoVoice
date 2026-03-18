import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
);

const version = packageJson.version;
const tagName = `v${version}`;
const publishConfig = packageJson.build?.publish?.[0] ?? {};
const owner = publishConfig.owner;
const repo = publishConfig.repo;

if (!owner || !repo) {
  throw new Error("GitHub publish config mancante in package.json.");
}

const token =
  process.env.GH_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.GH_PAT ||
  "";

if (!token) {
  throw new Error(
    "Token GitHub non trovato. Imposta GH_TOKEN o GITHUB_TOKEN prima di eseguire la release.",
  );
}

function git(...args) {
  return execFileSync("C:\\Program Files\\Git\\cmd\\git.exe", args, {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();
}

async function githubRequest(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "BingoVoice-Release-Notes",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function formatCommitList(commitMessages) {
  if (commitMessages.length === 0) {
    return ["- Miglioramenti tecnici e ottimizzazioni interne."];
  }

  return commitMessages.map((message) => `- ${message}`);
}

function sanitizeMessage(message) {
  return message
    .split("\n")[0]
    .replace(/^v?\d+\.\d+\.\d+\s*/i, "")
    .trim();
}

function buildReleaseBody({ version: currentVersion, previousTag, commitMessages }) {
  const changes = formatCommitList(commitMessages);
  const intro = `Versione ${currentVersion} di BingoVoice.`;
  const comparison = previousTag
    ? `Aggiornamento rispetto a \`${previousTag}\`.`
    : "Prima release pubblicata con note automatiche.";

  return [
    "## Cosa cambia",
    "",
    intro,
    comparison,
    "",
    ...changes,
    "",
    "## Aggiornamento",
    "",
    "- Apri BingoVoice e conferma l'aggiornamento quando compare l'avviso.",
    "- Al termine del download il programma installerà la nuova versione e si riavvierà automaticamente.",
  ].join("\n");
}

async function getPreviousTag() {
  const releases = await githubRequest(`/repos/${owner}/${repo}/releases?per_page=20`);

  const stableReleases = releases
    .filter((release) => !release.draft && !release.prerelease && release.tag_name !== tagName)
    .sort((a, b) => new Date(b.published_at ?? 0) - new Date(a.published_at ?? 0));

  return stableReleases[0]?.tag_name ?? null;
}

async function getCommitMessages(previousTag) {
  if (previousTag) {
    const compare = await githubRequest(
      `/repos/${owner}/${repo}/compare/${encodeURIComponent(previousTag)}...${encodeURIComponent(tagName)}`,
    );

    return (compare.commits ?? [])
      .map((commit) => sanitizeMessage(commit.commit?.message ?? ""))
      .filter(Boolean);
  }

  const currentCommit = git("rev-parse", "HEAD");
  const initialCommit = git("rev-list", "--max-parents=0", "HEAD").split("\n")[0];
  const range = initialCommit === currentCommit ? currentCommit : `${initialCommit}..${currentCommit}`;
  const logOutput = git("log", range, "--pretty=%s");

  return logOutput
    .split("\n")
    .map(sanitizeMessage)
    .filter(Boolean);
}

async function updateReleaseNotes() {
  const release = await githubRequest(`/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tagName)}`);
  const previousTag = await getPreviousTag();
  const commitMessages = await getCommitMessages(previousTag);
  const body = buildReleaseBody({
    version,
    previousTag,
    commitMessages,
  });

  await githubRequest(`/repos/${owner}/${repo}/releases/${release.id}`, {
    method: "PATCH",
    body: {
      body,
      name: release.name || tagName,
    },
  });

  console.log(`Release notes aggiornate per ${tagName}.`);
}

updateReleaseNotes().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
