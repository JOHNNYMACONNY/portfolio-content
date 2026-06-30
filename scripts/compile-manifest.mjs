import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export async function compilePortfolio({ write = true } = {}) {
  const manifest = await readJson('content/manifest.json');
  const entries = Object.entries(manifest.projectFiles);
  const projects = [];

  for (const [slug, relativePath] of entries) {
    if (relativePath !== `content/projects/${slug}.json`) throw new Error(`Project path does not match slug: ${slug}`);
    const project = await readJson(relativePath);
    if (project.slug !== slug) throw new Error(`Project file slug does not match manifest: ${slug}`);
    projects.push(project);
  }

  const supportingWork = await readJson(manifest.supportingFile);
  const document = stable({
    schemaVersion: manifest.schemaVersion,
    contentVersion: manifest.contentVersion,
    publishedAt: manifest.publishedAt,
    flagshipOrder: manifest.flagshipOrder,
    homepageOrder: manifest.homepageOrder,
    projects,
    supportingWork,
    redirects: manifest.redirects,
  });

  const schema = await readJson('schemas/portfolio.schema.json');
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  if (!ajv.validate(schema, document)) {
    throw new Error(`JSON Schema validation failed:\n${ajv.errorsText(ajv.errors, { separator: '\n' })}`);
  }

  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  const hash = createHash('sha256').update(serialized).digest('hex');

  if (write) {
    await mkdir(path.join(root, 'dist'), { recursive: true });
    await writeFile(path.join(root, 'dist/portfolio.json'), serialized);
    await writeFile(path.join(root, 'dist/portfolio.sha256'), `${hash}  portfolio.json\n`);
  }

  return { document, serialized, hash };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await compilePortfolio();
  console.log(`Compiled ${result.document.projects.length} projects (${result.hash})`);
}
