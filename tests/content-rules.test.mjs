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

test('all public evidence and media URLs require HTTPS', () => {
  const evidence = clone(validDocument);
  evidence.projects[0].evidence[0].sourceUrl = 'http://example.com/report';
  assert.match(validateDocumentRules(evidence).join('\n'), /evidence URLs must use HTTPS/i);

  const media = clone(validDocument);
  media.projects[0].media.push({
    label: 'Demo',
    src: 'https://cdn.example.com/demo.mp4',
    alt: 'Demo video',
    kind: 'video',
    posterSrc: 'http://cdn.example.com/poster.jpg',
  });
  assert.match(validateDocumentRules(media).join('\n'), /public URLs must use HTTPS/i);
});

test('prospective paired evidence requires exactly two condition runs per task', () => {
  const document = clone(validDocument);
  document.projects[0].evidence[0].basis = {
    studyClass: 'prospective-paired-study',
    sampleSize: 10,
    sampleUnit: 'paired-task',
    conditionRunCount: 19,
    sourcePath: 'data/evidence/real_project_report.md',
    sourceCommit: '91f37272a49d0d05f4eee35228a1339d44594c70',
    generalizationBoundary: 'This sample did not demonstrate a generalized improvement.',
  };
  assert.match(validateDocumentRules(document).join('\n'), /two condition runs per task/i);
});

test('caption metadata is complete and restricted to videos', () => {
  const missingLabel = clone(validDocument);
  missingLabel.projects[0].media.push({
    label: 'Demo',
    src: 'https://cdn.example.com/demo.mp4',
    alt: 'Demo video',
    kind: 'video',
    captionSrc: 'https://cdn.example.com/demo.vtt',
    captionLanguage: 'en',
  });
  assert.match(validateDocumentRules(missingLabel).join('\n'), /requires language and label/i);

  const image = clone(validDocument);
  image.projects[0].media.push({
    label: 'Screenshot',
    src: 'https://cdn.example.com/image.png',
    alt: 'Screenshot',
    kind: 'image',
    posterSrc: 'https://cdn.example.com/poster.jpg',
  });
  assert.match(validateDocumentRules(image).join('\n'), /only valid for video/i);
});
