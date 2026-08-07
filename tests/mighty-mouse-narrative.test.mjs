import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePortfolio } from '../scripts/compile-manifest.mjs';

const { document } = await compilePortfolio({ write: false });
const project = document.projects.find((item) => item.slug === 'mighty-mouse');

test('Mighty Mouse leads with the completed prospective study and its mixed result', () => {
  assert.ok(project);
  assert.deepEqual(project.evidence.slice(0, 4).map((item) => item.value), [
    '6/10 vs 6/10',
    '4 vs 6',
    '4.60 vs 4.30',
    '262.5s vs 229.5s',
  ]);
  assert.ok(project.evidence.slice(0, 4).every((item) => item.basis.studyClass === 'prospective-paired-study'));
  assert.ok(project.evidence.slice(0, 4).every((item) => item.basis.sampleSize === 10 && item.basis.conditionRunCount === 20));
  assert.match(JSON.stringify(project), /no generalized improvement was demonstrated/i);
  assert.doesNotMatch(JSON.stringify(project), /collecting|~45%/i);
});

test('Mighty Mouse keeps synthetic evidence bounded and links immutable proof', () => {
  const historical = project.evidence.find((item) => item.value === '29.5%');
  assert.equal(historical?.basis.studyClass, 'promotion-benchmark');
  assert.match(historical?.limitation || '', /historical synthetic result/i);
  assert.ok(project.evidence.every((item) => item.sourceUrl?.includes('/blob/91f37272a49d0d05f4eee35228a1339d44594c70/')));
  assert.deepEqual(project.links.map((link) => link.kind), ['source', 'release', 'evidence', 'evidence']);
});
