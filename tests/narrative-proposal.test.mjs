import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvidencePacket } from '../scripts/build-evidence-packet.mjs';
import { extractMetricTokens, validateNarrativeProposal } from '../scripts/narrative-proposal.mjs';
import { runNarrativeAgent } from '../scripts/run-narrative-agent.mjs';

const evidencePacket = {
  schemaVersion: 1,
  projectSlug: 'mighty-mouse',
  sourceRepository: 'JOHNNYMACONNY/mighty-mouse',
  sourceRange: { base: 'a'.repeat(40), head: 'b'.repeat(40) },
  evidence: [
    { id: 'evidence:eval/results/PROMOTION_NOTES.md', supportedMetrics: ['29.5%', '30 trials'] },
    { id: 'commit:test', supportedMetrics: [] },
  ],
};

const validProposal = {
  schemaVersion: 1,
  projectSlug: 'mighty-mouse',
  sourceRepository: 'JOHNNYMACONNY/mighty-mouse',
  sourceRange: evidencePacket.sourceRange,
  confidence: 0.82,
  unresolvedQuestions: ['Does this generalize to another model family?'],
  privacyScan: { passed: true, findings: [] },
  changes: [
    {
      field: 'narrative.currentStatus',
      sentences: [
        { text: 'The recorded suite retained a 29.5% average latency improvement.', evidenceRefs: ['evidence:eval/results/PROMOTION_NOTES.md'] },
        { text: 'This remains an active research direction.', editorial: true },
      ],
    },
  ],
};

test('metrics are normalized and evidence-backed proposals pass', () => {
  assert.deepEqual(extractMetricTokens('Across 30 trials the result improved 29.5%.'), ['30 trials', '29.5%']);
  assert.deepEqual(validateNarrativeProposal(validProposal, evidencePacket), []);
});

test('unsupported metrics, private paths, and unreferenced sentences fail', () => {
  const unsupported = structuredClone(validProposal);
  unsupported.changes[0].sentences[0].text = 'The system improved 999%.';
  assert.match(validateNarrativeProposal(unsupported, evidencePacket).join('\n'), /unsupported metric/i);

  const privatePath = structuredClone(validProposal);
  privatePath.changes[0].sentences[1].text = 'See /Users/private/project/results.';
  assert.match(validateNarrativeProposal(privatePath, evidencePacket).join('\n'), /forbidden private/i);

  const unreferenced = structuredClone(validProposal);
  unreferenced.changes[0].sentences[1] = { text: 'Unlabeled interpretation.' };
  assert.match(validateNarrativeProposal(unreferenced, evidencePacket).join('\n'), /lacks evidence/i);
});

test('narrative agent can be disabled without affecting deterministic workflows', async () => {
  assert.deepEqual(await runNarrativeAgent({ commandJson: '', evidencePath: 'unused', outputPath: 'unused' }), { status: 'disabled' });
});

test('evidence packets contain exact public sources without patches or file contents', () => {
  const packet = buildEvidencePacket({
    project: { slug: 'mighty-mouse', sourceRepositories: ['JOHNNYMACONNY/mighty-mouse'] },
    repository: 'JOHNNYMACONNY/mighty-mouse',
    base: 'a'.repeat(40),
    head: 'b'.repeat(40),
    compare: {
      html_url: 'https://github.com/JOHNNYMACONNY/mighty-mouse/compare/base...head',
      commits: [{ sha: 'b'.repeat(40), html_url: 'https://github.com/JOHNNYMACONNY/mighty-mouse/commit/test', commit: { message: 'Document evaluation result' } }],
      files: [{ filename: 'eval/results/PROMOTION_NOTES.md', status: 'modified', additions: 2, deletions: 1, blob_url: 'https://github.com/JOHNNYMACONNY/mighty-mouse/blob/head/eval/results/PROMOTION_NOTES.md' }],
    },
    evidenceFiles: {
      'eval/results/PROMOTION_NOTES.md': { url: 'https://github.com/JOHNNYMACONNY/mighty-mouse/blob/head/eval/results/PROMOTION_NOTES.md', blobSha: 'c'.repeat(40), supportedMetrics: ['29.5%'] },
    },
  });
  assert.equal(packet.evidence.length, 2);
  assert.equal(JSON.stringify(packet).includes('patch'), false);
  assert.deepEqual(packet.evidence.find((item) => item.id.startsWith('file:')).supportedMetrics, ['29.5%']);
});

test('provider-neutral adapter executes a bounded command and validates its output', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'portfolio-agent-'));
  const evidencePath = path.join(directory, 'evidence.json');
  const outputPath = path.join(directory, 'proposal.json');
  await writeFile(evidencePath, `${JSON.stringify(evidencePacket)}\n`);
  const fixture = fileURLToPath(new URL('./fixtures/mock-narrative-agent.mjs', import.meta.url));

  const result = await runNarrativeAgent({
    commandJson: JSON.stringify([process.execPath, fixture]),
    evidencePath,
    outputPath,
  });
  assert.equal(result.status, 'proposed');
});
