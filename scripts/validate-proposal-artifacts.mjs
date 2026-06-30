import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProposalFiles } from './validate-narrative-proposal.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proposalRoot = path.join(root, 'proposals');

async function jsonFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? jsonFiles(path.join(directory, entry.name))
    : entry.name.endsWith('.json') ? [path.join(directory, entry.name)] : []));
  return nested.flat();
}

const proposals = await jsonFiles(proposalRoot);
for (const proposalPath of proposals) {
  const relative = path.relative(proposalRoot, proposalPath);
  const evidencePath = path.join(root, 'evidence-packets', relative);
  await validateProposalFiles(proposalPath, evidencePath);
}
console.log(`Validated ${proposals.length} narrative proposal artifact(s)`);
