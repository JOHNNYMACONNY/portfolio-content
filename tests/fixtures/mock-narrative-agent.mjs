import { readFile, writeFile } from 'node:fs/promises';

const valueAfter = (flag) => process.argv[process.argv.indexOf(flag) + 1];
const evidence = JSON.parse(await readFile(valueAfter('--evidence-packet'), 'utf8'));
const proposal = {
  schemaVersion: 1,
  projectSlug: evidence.projectSlug,
  sourceRepository: evidence.sourceRepository,
  sourceRange: evidence.sourceRange,
  confidence: 0.7,
  unresolvedQuestions: ['Should this wording replace the existing current-status sentence?'],
  privacyScan: { passed: true, findings: [] },
  changes: [{
    field: 'narrative.currentStatus',
    sentences: [{ text: 'The project remains under active evaluation.', editorial: true }],
  }],
};
await writeFile(valueAfter('--output'), `${JSON.stringify(proposal, null, 2)}\n`);
