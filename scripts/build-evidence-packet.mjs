import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractMetricTokens } from './narrative-proposal.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = /\/(?:Users|Volumes|home)\/|\b(?:ghp|github_pat|sk|sb_secret)_[A-Za-z0-9_-]{12,}\b/;
const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
};

function provenancePath(value) {
  const candidate = value?.split(/\s+—\s+/)[0]?.trim();
  return candidate && /^[A-Za-z0-9_.\/-]+$/.test(candidate) && !candidate.includes('..') ? candidate : null;
}

async function githubJson(url, token, fetchImpl = fetch, allow404 = false) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ybf-portfolio-evidence-builder',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(url, { headers });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub evidence request failed: ${response.status}`);
  return response.json();
}

export function buildEvidencePacket({ project, repository, base, head, compare, evidenceFiles }) {
  if (!project.sourceRepositories?.includes(repository)) throw new Error(`${repository} is not allowlisted for ${project.slug}`);
  const evidence = [];

  for (const commit of compare.commits || []) {
    evidence.push({
      id: `commit:${commit.sha}`,
      kind: 'commit',
      url: commit.html_url,
      summary: commit.commit?.message?.split('\n')[0] || commit.sha,
      supportedMetrics: [],
    });
  }
  for (const file of compare.files || []) {
    evidence.push({
      id: `file:${file.filename}`,
      kind: 'changed-file',
      url: file.blob_url,
      summary: `${file.status}; +${file.additions}/-${file.deletions}`,
      supportedMetrics: evidenceFiles[file.filename]?.supportedMetrics || [],
    });
  }
  for (const [filePath, record] of Object.entries(evidenceFiles)) {
    if (evidence.some((item) => item.id === `file:${filePath}`)) continue;
    evidence.push({
      id: `evidence:${filePath}`,
      kind: 'evidence-file',
      url: record.url,
      summary: 'Explicitly named public evidence file',
      supportedMetrics: record.supportedMetrics,
      blobSha: record.blobSha,
    });
  }

  const packet = {
    schemaVersion: 1,
    projectSlug: project.slug,
    sourceRepository: repository,
    sourceRange: { base, head },
    compareUrl: compare.html_url,
    changedFiles: (compare.files || []).map((file) => ({
      path: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      url: file.blob_url,
    })),
    evidence,
    privacyScan: { passed: true, findings: [] },
  };
  if (forbidden.test(JSON.stringify(packet))) throw new Error('Evidence packet contains forbidden private or credential-like text');
  return packet;
}

export async function collectEvidencePacket({ repository, projectSlug, base, head, token = process.env.GITHUB_TOKEN, fetchImpl = fetch }) {
  if (!/^[a-f0-9]{40}$/i.test(base) || !/^[a-f0-9]{40}$/i.test(head)) throw new Error('Evidence ranges require full commit SHAs');
  const project = JSON.parse(await readFile(path.join(root, `content/projects/${projectSlug}.json`), 'utf8'));
  const repositoryData = await githubJson(`https://api.github.com/repos/${repository}`, token, fetchImpl);
  if (repositoryData.private) throw new Error('Narrative evidence automation only accepts public repositories');
  const compare = await githubJson(`https://api.github.com/repos/${repository}/compare/${base}...${head}`, token, fetchImpl);
  const evidenceFiles = {};

  for (const evidenceItem of project.evidence) {
    const filePath = provenancePath(evidenceItem.provenance);
    if (!filePath || evidenceFiles[filePath]) continue;
    const file = await githubJson(`https://api.github.com/repos/${repository}/contents/${filePath}?ref=${head}`, token, fetchImpl, true);
    if (!file?.content || file.encoding !== 'base64') continue;
    const content = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
    evidenceFiles[filePath] = {
      url: file.html_url,
      blobSha: file.sha,
      supportedMetrics: extractMetricTokens(content),
    };
  }

  return buildEvidencePacket({ project, repository, base, head, compare, evidenceFiles });
}

async function main() {
  const output = arg('--output');
  if (!output) throw new Error('Pass --output <path>');
  const packet = await collectEvidencePacket({
    repository: arg('--repository'),
    projectSlug: arg('--project'),
    base: arg('--base'),
    head: arg('--head'),
  });
  await writeFile(path.resolve(output), `${JSON.stringify(packet, null, 2)}\n`);
  console.log(`Built evidence packet with ${packet.evidence.length} auditable sources`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
