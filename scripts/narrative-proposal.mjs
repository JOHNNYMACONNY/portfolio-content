const protectedAutomaticFields = new Set([
  'repositoryMetadata',
  'repositoryMetadataPolicy',
  'sourceRepositories',
]);

const reviewOnlyFields = [
  'shortOutcome',
  'role',
  'ownership',
  'evidence',
  'media',
  'status',
  'featured',
  'homepage',
  'narrative.problem',
  'narrative.ownership',
  'narrative.decisions',
  'narrative.buildRecord',
  'narrative.failures',
  'narrative.currentStatus',
];

const forbiddenPatterns = [
  /\/(?:Users|Volumes)\/[A-Za-z0-9._-]+\//,
  /\/home\/[A-Za-z0-9._-]+\//,
  /\b(?:ghp|github_pat|sk|sb_secret)_[A-Za-z0-9_-]{12,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export function extractMetricTokens(text) {
  return Array.from(new Set((text.match(/~?\d+(?:\.\d+)?%|\d+\s+trials?/gi) || []).map((token) => token.toLowerCase().replace(/\s+/g, ' '))));
}

export function validateNarrativeProposal(proposal, evidencePacket) {
  const errors = [];
  if (proposal.schemaVersion !== 1) errors.push('Proposal schemaVersion must be 1');
  if (proposal.projectSlug !== evidencePacket.projectSlug) errors.push('Proposal projectSlug does not match evidence packet');
  if (proposal.sourceRepository !== evidencePacket.sourceRepository) errors.push('Proposal sourceRepository does not match evidence packet');
  if (proposal.sourceRange?.base !== evidencePacket.sourceRange.base || proposal.sourceRange?.head !== evidencePacket.sourceRange.head) errors.push('Proposal source range does not match evidence packet');
  if (typeof proposal.confidence !== 'number' || proposal.confidence < 0 || proposal.confidence > 1) errors.push('Proposal confidence must be between 0 and 1');
  if (!Array.isArray(proposal.unresolvedQuestions)) errors.push('Proposal unresolvedQuestions must be an array');
  if (proposal.privacyScan?.passed !== true || (proposal.privacyScan?.findings || []).length) errors.push('Proposal privacy scan must pass with no findings');
  if (!Array.isArray(proposal.changes) || !proposal.changes.length) errors.push('Proposal must contain at least one review-only change');

  const evidenceById = new Map((evidencePacket.evidence || []).map((item) => [item.id, item]));
  for (const change of proposal.changes || []) {
    if (protectedAutomaticFields.has(change.field) || !reviewOnlyFields.includes(change.field)) errors.push(`Proposal field is not review-eligible: ${change.field}`);
    if (!Array.isArray(change.sentences) || !change.sentences.length) errors.push(`Proposal change needs sentence provenance: ${change.field}`);

    for (const sentence of change.sentences || []) {
      const refs = Array.isArray(sentence.evidenceRefs) ? sentence.evidenceRefs : [];
      const editorial = sentence.editorial === true;
      if (!editorial && !refs.length) errors.push(`Sentence lacks evidence or editorial label: ${sentence.text || '<missing>'}`);
      for (const ref of refs) if (!evidenceById.has(ref)) errors.push(`Unknown evidence reference: ${ref}`);

      const metrics = extractMetricTokens(sentence.text || '');
      if (metrics.length) {
        if (!refs.length || editorial) errors.push(`Metric-bearing sentence must be evidence-backed, not editorial: ${sentence.text}`);
        const supported = new Set(refs.flatMap((ref) => evidenceById.get(ref)?.supportedMetrics || []));
        for (const metric of metrics) if (!supported.has(metric)) errors.push(`Unsupported metric in proposal: ${metric}`);
      }
    }
  }

  const serialized = JSON.stringify(proposal);
  for (const pattern of forbiddenPatterns) if (pattern.test(serialized)) errors.push(`Proposal contains forbidden private or credential-like text: ${pattern.source}`);
  return errors;
}
