import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Pass the path to work.fallback.json');

const source = JSON.parse(await readFile(path.resolve(sourcePath), 'utf8'));
await mkdir(path.join(root, 'content/projects'), { recursive: true });
await mkdir(path.join(root, 'content/supporting'), { recursive: true });

for (const project of source.projects) {
  await writeFile(path.join(root, `content/projects/${project.slug}.json`), `${JSON.stringify(project, null, 2)}\n`);
}
await writeFile(path.join(root, 'content/supporting/projects.json'), `${JSON.stringify(source.supportingWork, null, 2)}\n`);
console.log(`Imported ${source.projects.length} projects and ${source.supportingWork.length} supporting records`);
