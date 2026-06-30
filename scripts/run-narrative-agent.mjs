import { access, appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateProposalFiles } from './validate-narrative-proposal.mjs';

const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
};

export async function runNarrativeAgent({ commandJson, evidencePath, outputPath }) {
  if (!commandJson) {
    console.log('Narrative agent disabled; deterministic synchronization remains active.');
    return { status: 'disabled' };
  }

  let command;
  try {
    command = JSON.parse(commandJson);
  } catch {
    throw new Error('PORTFOLIO_NARRATIVE_AGENT_COMMAND_JSON must be a JSON string array');
  }
  if (!Array.isArray(command) || !command.length || command.some((part) => typeof part !== 'string' || !part)) {
    throw new Error('Narrative agent command must be a non-empty string array');
  }

  await new Promise((resolve, reject) => {
    const child = spawn(command[0], [...command.slice(1), '--evidence-packet', evidencePath, '--output', outputPath], {
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Narrative agent exited with ${code}`)));
  });

  await access(outputPath);
  await validateProposalFiles(outputPath, evidencePath);
  return { status: 'proposed', outputPath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runNarrativeAgent({
    commandJson: process.env.PORTFOLIO_NARRATIVE_AGENT_COMMAND_JSON,
    evidencePath: arg('--evidence'),
    outputPath: arg('--output'),
  }).then((result) => {
    if (process.env.GITHUB_OUTPUT) return appendFile(process.env.GITHUB_OUTPUT, `status=${result.status}\n`);
    return undefined;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
