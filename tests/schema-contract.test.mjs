import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { compilePortfolio } from '../scripts/compile-manifest.mjs';

const schema = JSON.parse(await readFile(new URL('../schemas/portfolio.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = (value) => JSON.parse(JSON.stringify(value));
const { document: validDocument } = await compilePortfolio({ write: false });

test('shared schema accepts prospective evidence, explicit link intents, and accessible video metadata', () => {
  const document = clone(validDocument);
  document.projects[0].evidence[0].basis = {
    studyClass: 'prospective-paired-study',
    sampleSize: 10,
    sampleUnit: 'paired-task',
    conditionRunCount: 20,
    sourcePath: 'data/evidence/real_project_report.md',
    sourceCommit: '91f37272a49d0d05f4eee35228a1339d44594c70',
    generalizationBoundary: 'This sample did not demonstrate a generalized improvement.',
  };
  document.projects[0].links.push(
    { label: 'Release', href: 'https://example.com/release', kind: 'release' },
    { label: 'Evidence', href: 'https://example.com/evidence', kind: 'evidence' },
    { label: 'Demo', href: 'https://example.com/demo', kind: 'demo' },
  );
  document.projects[0].media.push({
    label: 'Demo',
    src: 'https://cdn.example.com/demo.mp4',
    alt: 'Mighty Mouse verification demo',
    kind: 'video',
    posterSrc: 'https://cdn.example.com/demo.jpg',
    captionSrc: 'https://cdn.example.com/demo.vtt',
    captionLanguage: 'en-US',
    captionLabel: 'English',
  });

  assert.equal(validate(document), true, ajv.errorsText(validate.errors));
});

test('shared schema rejects incomplete caption metadata', () => {
  const document = clone(validDocument);
  document.projects[0].media.push({
    label: 'Demo',
    src: 'https://cdn.example.com/demo.mp4',
    alt: 'Mighty Mouse verification demo',
    kind: 'video',
    captionSrc: 'https://cdn.example.com/demo.vtt',
  });

  assert.equal(validate(document), false);
  assert.match(ajv.errorsText(validate.errors), /captionLanguage|captionLabel/);
});
