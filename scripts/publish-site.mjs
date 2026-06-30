import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const siteUrl = process.env.PORTFOLIO_SITE_URL?.replace(/\/$/, '');
const secret = process.env.PORTFOLIO_REVALIDATE_SECRET;
const repository = process.env.GITHUB_REPOSITORY;
const commitSha = process.env.GITHUB_SHA;
const affected = JSON.parse(process.env.AFFECTED_JSON || '{}');
if (!siteUrl || !secret || !repository || !commitSha) throw new Error('Publication environment is incomplete');

const contentSha = (await readFile('dist/portfolio.sha256', 'utf8')).trim().split(/\s+/)[0];
const payload = JSON.stringify({
  source: 'portfolio-content',
  repository,
  commitSha,
  contentSha,
  changedSlugs: affected.changedSlugs || [],
  deletedSlugs: affected.deletedSlugs || [],
  orderingChanged: Boolean(affected.orderingChanged),
  timestamp: Date.now(),
});
const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
const response = await fetch(`${siteUrl}/api/portfolio/revalidate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Portfolio-Signature': signature },
  body: payload,
});
if (!response.ok) throw new Error(`Revalidation endpoint returned ${response.status}`);

const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  const health = await fetch(`${siteUrl}/work`, { headers: { 'Cache-Control': 'no-cache' } });
  const html = await health.text();
  if (health.ok && html.includes(`name="portfolio-content-sha" content="${contentSha}"`)) {
    console.log(`Published and verified ${contentSha}`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
throw new Error(`Live /work did not report expected content SHA ${contentSha}`);
