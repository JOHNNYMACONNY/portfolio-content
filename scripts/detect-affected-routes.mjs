import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : '';
};

let before = valueAfter('--before');
const after = valueAfter('--after') || 'HEAD';
if (!before) throw new Error('Pass --before <git-sha>');
if (/^0{40}$/.test(before)) {
  before = execFileSync('git', ['hash-object', '-t', 'tree', '/dev/null'], { encoding: 'utf8' }).trim();
}

const changed = execFileSync('git', ['diff', '--name-status', before, after, '--', 'content', 'assets', 'schemas'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const changedSlugs = new Set();
const deletedSlugs = new Set();
let orderingChanged = false;

for (const line of changed) {
  const [status, file] = line.split(/\t/);
  if (file === 'content/manifest.json') orderingChanged = true;
  const match = file?.match(/^content\/projects\/([a-z0-9-]+)\.json$/);
  if (!match) continue;
  if (status.startsWith('D')) deletedSlugs.add(match[1]);
  else changedSlugs.add(match[1]);
}

const payload = {
  changedSlugs: Array.from(changedSlugs).sort(),
  deletedSlugs: Array.from(deletedSlugs).sort(),
  orderingChanged,
};
const serialized = JSON.stringify(payload);
console.log(serialized);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `payload=${serialized}\n`);
