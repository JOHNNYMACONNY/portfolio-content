import { compilePortfolio } from './compile-manifest.mjs';
import { validateDocumentRules } from './content-rules.mjs';

const { document } = await compilePortfolio({ write: false });
const blockedTerms = (process.env.PORTFOLIO_BLOCKED_TERMS || '').split(',').map((term) => term.trim()).filter(Boolean);
const errors = validateDocumentRules(document, blockedTerms);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${document.projects.length} projects and ${document.supportingWork.length} supporting records`);
