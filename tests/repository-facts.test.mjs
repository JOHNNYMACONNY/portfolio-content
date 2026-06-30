import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { applyRepositoryFacts, buildRepositoryMetadata } from '../scripts/repository-facts.mjs';
import { verifyAutomaticProjectChange } from '../scripts/verify-automatic-diff.mjs';

const sourceProject = JSON.parse(await readFile(new URL('../content/projects/mighty-mouse.json', import.meta.url), 'utf8'));
const repositoryResponse = {
  full_name: 'JOHNNYMACONNY/mighty-mouse',
  html_url: 'https://github.com/JOHNNYMACONNY/mighty-mouse',
  homepage: '',
  private: false,
  archived: false,
  language: 'Python',
  topics: ['local-ai', 'unapproved-topic'],
  pushed_at: '2026-06-30T08:14:24Z',
};

test('allowlisted facts create one minimal repositoryMetadata change', () => {
  const projectWithoutMetadata = structuredClone(sourceProject);
  delete projectWithoutMetadata.repositoryMetadata;
  const metadata = buildRepositoryMetadata('JOHNNYMACONNY/mighty-mouse', repositoryResponse, null, ['local-ai']);
  const result = applyRepositoryFacts(projectWithoutMetadata, 'JOHNNYMACONNY/mighty-mouse', metadata);
  assert.equal(result.changed, true);
  assert.deepEqual(result.project.repositoryMetadata.topics, ['local-ai']);
  assert.deepEqual(verifyAutomaticProjectChange(projectWithoutMetadata, result.project).changedPaths.sort(), [
    '/repositoryMetadata/archived',
    '/repositoryMetadata/latestRelease',
    '/repositoryMetadata/primaryLanguage',
    '/repositoryMetadata/pushedAt',
    '/repositoryMetadata/repository',
    '/repositoryMetadata/topics',
    '/repositoryMetadata/url',
  ]);

  const repeated = applyRepositoryFacts(result.project, 'JOHNNYMACONNY/mighty-mouse', metadata);
  assert.equal(repeated.changed, false, 'identical repository facts must be a logged no-op');
});

test('private sources and non-allowlisted repositories fail closed', () => {
  assert.throws(() => buildRepositoryMetadata('JOHNNYMACONNY/mighty-mouse', { ...repositoryResponse, private: true }, null), /public source/);
  assert.throws(() => applyRepositoryFacts(sourceProject, 'someone/else', {}), /not an allowlisted source/);
});

test('narrative and evidence changes cannot pass the automatic-diff guard', () => {
  const narrative = structuredClone(sourceProject);
  narrative.shortOutcome = 'Inflated automatic claim';
  assert.throws(() => verifyAutomaticProjectChange(sourceProject, narrative), /protected field/);

  const evidence = structuredClone(sourceProject);
  evidence.evidence[0].value = '999%';
  assert.throws(() => verifyAutomaticProjectChange(sourceProject, evidence), /protected field/);
});
