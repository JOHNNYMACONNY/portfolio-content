import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateNarrativeProposal } from './narrative-proposal.mjs';

const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
};

export async function validateProposalFiles(proposalPath, evidencePath) {
  const proposal = JSON.parse(await readFile(proposalPath, 'utf8'));
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  const errors = validateNarrativeProposal(proposal, evidence);
  if (errors.length) throw new Error(errors.join('\n'));
  return { proposal, evidence };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateProposalFiles(arg('--proposal'), arg('--evidence'))
    .then(() => console.log('Narrative proposal passed evidence, metric, and privacy validation'))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
