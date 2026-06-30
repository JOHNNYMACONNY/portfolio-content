import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePortfolio } from './compile-manifest.mjs';
import { applyRepositoryFacts, buildRepositoryMetadata, fetchRepositoryFacts } from './repository-facts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : '';
};

export async function syncRepositoryFacts({ repository, fixturePath, token = process.env.GITHUB_TOKEN }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Pass --repository owner/name');
  const manifest = JSON.parse(await readFile(path.join(root, 'content/manifest.json'), 'utf8'));
  let matched = null;

  for (const [slug, relativePath] of Object.entries(manifest.projectFiles)) {
    const project = JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
    if (project.sourceRepositories?.includes(repository)) {
      if (matched) throw new Error(`${repository} is mapped to more than one project`);
      matched = { slug, relativePath, project };
    }
  }

  if (!matched) throw new Error(`No portfolio project allows source repository ${repository}`);
  const facts = fixturePath
    ? JSON.parse(await readFile(path.resolve(fixturePath), 'utf8'))
    : await fetchRepositoryFacts(repository, token);
  const metadata = buildRepositoryMetadata(
    repository,
    facts.repositoryJson,
    facts.releaseJson,
    matched.project.repositoryMetadataPolicy.approvedTopics,
  );
  const result = applyRepositoryFacts(matched.project, repository, metadata);

  if (!result.changed) {
    console.log(`No deterministic repository fact changes for ${repository}`);
    return { changed: false, slug: matched.slug };
  }

  await writeFile(path.join(root, matched.relativePath), `${JSON.stringify(result.project, null, 2)}\n`);
  await compilePortfolio();
  console.log(`Updated allowlisted repository facts for ${matched.slug} from ${repository}`);
  return { changed: true, slug: matched.slug };
}

async function main() {
  const result = await syncRepositoryFacts({
    repository: valueAfter('--repository'),
    fixturePath: valueAfter('--fixture') || undefined,
  });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `changed=${result.changed}\nslug=${result.slug}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
