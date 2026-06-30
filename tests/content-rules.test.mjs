import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePortfolio } from '../scripts/compile-manifest.mjs';
import { validateDocumentRules } from '../scripts/content-rules.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const { document: validDocument } = await compilePortfolio({ write: false });

test('current compiled portfolio passes publication rules', () => {
  assert.deepEqual(validateDocumentRules(validDocument), []);
});

test('duplicate slug is rejected', () => {
  const document = clone(validDocument);
  document.projects[1].slug = document.projects[0].slug;
  assert.match(validateDocumentRules(document).join('\n'), /unique/i);
});

test('numeric evidence without provenance is rejected', () => {
  const document = clone(validDocument);
  delete document.projects[0].evidence[0].provenance;
  assert.match(validateDocumentRules(document).join('\n'), /provenance/i);
});

test('private local paths and credential-like values are rejected', () => {
  const localPath = clone(validDocument);
  localPath.projects[0].ownership = 'A long ownership statement with /Users/private/project/source included.';
  assert.match(validateDocumentRules(localPath).join('\n'), /forbidden/i);

  const credential = clone(validDocument);
  credential.projects[0].ownership = 'A long ownership statement with ghp_1234567890abcdefghijklmnop included.';
  assert.match(validateDocumentRules(credential).join('\n'), /forbidden/i);
});
