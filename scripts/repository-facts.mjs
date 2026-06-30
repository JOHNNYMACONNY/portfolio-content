export const AUTOMATIC_REPOSITORY_FIELDS = Object.freeze([
  'repositoryMetadata.archived',
  'repositoryMetadata.homepageUrl',
  'repositoryMetadata.latestRelease',
  'repositoryMetadata.primaryLanguage',
  'repositoryMetadata.pushedAt',
  'repositoryMetadata.repository',
  'repositoryMetadata.topics',
  'repositoryMetadata.url',
]);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};
const stableJson = (value) => JSON.stringify(canonicalize(value));

export function buildRepositoryMetadata(repository, repositoryResponse, releaseResponse, approvedTopics = []) {
  if (repositoryResponse.private) throw new Error(`Automatic repository metadata requires a public source: ${repository}`);
  if (repositoryResponse.full_name !== repository) throw new Error(`GitHub response did not match requested repository: ${repository}`);

  const approved = new Set(approvedTopics.map((topic) => topic.toLowerCase()));
  const metadata = {
    repository,
    url: repositoryResponse.html_url,
    latestRelease: releaseResponse ? {
      tag: releaseResponse.tag_name,
      publishedAt: releaseResponse.published_at,
      url: releaseResponse.html_url,
    } : null,
    topics: (repositoryResponse.topics || [])
      .filter((topic) => approved.has(topic.toLowerCase()))
      .sort((left, right) => left.localeCompare(right)),
    archived: Boolean(repositoryResponse.archived),
    pushedAt: repositoryResponse.pushed_at,
  };

  if (repositoryResponse.homepage) metadata.homepageUrl = repositoryResponse.homepage;
  if (repositoryResponse.language) metadata.primaryLanguage = repositoryResponse.language;
  return metadata;
}

export function applyRepositoryFacts(project, repository, desiredMetadata) {
  if (!project.sourceRepositories?.includes(repository)) {
    throw new Error(`${repository} is not an allowlisted source for ${project.slug}`);
  }

  const policy = project.repositoryMetadataPolicy;
  if (!policy) throw new Error(`${project.slug} has no repositoryMetadataPolicy`);
  const unknownFields = policy.automaticFields.filter((field) => !AUTOMATIC_REPOSITORY_FIELDS.includes(field));
  if (unknownFields.length) throw new Error(`Unsupported automatic fields: ${unknownFields.join(', ')}`);

  const currentMetadata = project.repositoryMetadata || {};
  const nextMetadata = { ...currentMetadata };
  for (const field of policy.automaticFields) {
    const key = field.slice('repositoryMetadata.'.length);
    if (Object.prototype.hasOwnProperty.call(desiredMetadata, key)) nextMetadata[key] = desiredMetadata[key];
    else delete nextMetadata[key];
  }

  const changed = stableJson(currentMetadata) !== stableJson(nextMetadata);
  return {
    changed,
    project: changed ? { ...project, repositoryMetadata: nextMetadata } : project,
  };
}

export async function fetchRepositoryFacts(repository, token, fetchImpl = fetch) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ybf-portfolio-repository-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const repositoryResponse = await fetchImpl(`https://api.github.com/repos/${repository}`, { headers });
  if (!repositoryResponse.ok) throw new Error(`GitHub repository request failed: ${repositoryResponse.status}`);
  const repositoryJson = await repositoryResponse.json();

  const releaseResponse = await fetchImpl(`https://api.github.com/repos/${repository}/releases/latest`, { headers });
  const releaseJson = releaseResponse.status === 404
    ? null
    : releaseResponse.ok
      ? await releaseResponse.json()
      : (() => { throw new Error(`GitHub release request failed: ${releaseResponse.status}`); })();

  return { repositoryJson, releaseJson };
}
