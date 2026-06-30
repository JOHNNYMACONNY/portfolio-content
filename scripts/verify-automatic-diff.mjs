import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function diffObjectPaths(before, after, prefix = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const beforeIsObject = before && typeof before === 'object' && !Array.isArray(before);
  const afterIsObject = after && typeof after === 'object' && !Array.isArray(after);
  if ((!before && afterIsObject) || (!after && beforeIsObject)) {
    return diffObjectPaths(beforeIsObject ? before : {}, afterIsObject ? after : {}, prefix);
  }
  if (Array.isArray(before) || Array.isArray(after) || typeof before !== 'object' || typeof after !== 'object' || before === null || after === null) {
    return [prefix || '/'];
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).flatMap((key) => diffObjectPaths(before[key], after[key], `${prefix}/${key}`));
}

export function verifyAutomaticProjectChange(before, after) {
  if (before.slug !== after.slug) throw new Error('Automatic update cannot change project slug');
  const changedPaths = diffObjectPaths(before, after);
  if (!changedPaths.length) return { changedPaths: [] };

  const allowed = new Set(before.repositoryMetadataPolicy?.automaticFields || []);
  for (const changedPath of changedPaths) {
    const match = changedPath.match(/^\/repositoryMetadata\/([^/]+)(?:\/.*)?$/);
    const field = match ? `repositoryMetadata.${match[1]}` : null;
    if (!field || !allowed.has(field)) throw new Error(`Automatic update attempted protected field: ${changedPath}`);
  }

  return { changedPaths };
}

export function verifyAutomaticGitDiff(baseRef, headRef) {
  const changedFiles = git(['diff', '--name-only', baseRef, headRef]).split('\n').filter(Boolean);
  const projectFiles = changedFiles.filter((file) => /^content\/projects\/[a-z0-9-]+\.json$/.test(file));
  const allowedFile = (file) => /^content\/projects\/[a-z0-9-]+\.json$/.test(file) || /^dist\/portfolio\.(json|sha256)$/.test(file);

  if (changedFiles.some((file) => !allowedFile(file))) throw new Error(`Automatic branch changed protected files: ${changedFiles.filter((file) => !allowedFile(file)).join(', ')}`);
  if (projectFiles.length !== 1) throw new Error(`Automatic branch must change exactly one project file; found ${projectFiles.length}`);

  const projectFile = projectFiles[0];
  const before = JSON.parse(git(['show', `${baseRef}:${projectFile}`]));
  const after = JSON.parse(git(['show', `${headRef}:${projectFile}`]));
  const result = verifyAutomaticProjectChange(before, after);
  return { projectFile, changedFiles, changedPaths: result.changedPaths };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseIndex = process.argv.indexOf('--base');
  const headIndex = process.argv.indexOf('--head');
  const result = verifyAutomaticGitDiff(baseIndex >= 0 ? process.argv[baseIndex + 1] : 'origin/main', headIndex >= 0 ? process.argv[headIndex + 1] : 'HEAD');
  console.log(JSON.stringify(result));
}
