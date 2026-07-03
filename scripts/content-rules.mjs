const forbiddenPatterns = [
  /\/(?:Users|Volumes)\/[A-Za-z0-9._-]+\//,
  /\/home\/[A-Za-z0-9._-]+\//,
  /\b(?:ghp|github_pat|sk|sb_secret)_[A-Za-z0-9_-]{12,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export function validateDocumentRules(document, blockedTerms = []) {
  const serialized = JSON.stringify(document);
  const errors = [];
  const projectSlugs = document.projects.map((project) => project.slug);

  if (new Set(projectSlugs).size !== projectSlugs.length) errors.push('Project slugs must be unique');
  if (new Set(document.supportingWork.map((project) => project.slug)).size !== document.supportingWork.length) errors.push('Supporting project slugs must be unique');

  const published = new Map(document.projects.filter((project) => project.visibility !== 'hidden').map((project) => [project.slug, project]));
  for (const slug of document.flagshipOrder) {
    if (!published.get(slug)?.featured) errors.push(`Flagship is missing, hidden, or not featured: ${slug}`);
  }
  for (const slug of document.homepageOrder) {
    if (!document.flagshipOrder.includes(slug) || !published.get(slug)?.homepage) errors.push(`Homepage project is not a published flagship: ${slug}`);
  }

  for (const project of document.projects) {
    for (const evidence of project.evidence) {
      if (/\d/.test(evidence.value) && !evidence.provenance && !evidence.sourceUrl) errors.push(`${project.slug}: numeric evidence requires provenance or sourceUrl (${evidence.label})`);
      if ((/^~|≈/).test(evidence.value) && !evidence.limitation) errors.push(`${project.slug}: approximate evidence requires a limitation (${evidence.label})`);
      if (evidence.sourceUrl && !evidence.sourceUrl.startsWith('https://')) errors.push(`${project.slug}: evidence URLs must use HTTPS (${evidence.sourceUrl})`);
      if (evidence.basis?.studyClass === 'prospective-paired-study') {
        if (evidence.basis.sampleUnit !== 'paired-task') errors.push(`${project.slug}: prospective evidence must use paired-task as its sample unit (${evidence.label})`);
        if (evidence.basis.conditionRunCount !== evidence.basis.sampleSize * 2) errors.push(`${project.slug}: prospective paired evidence must contain two condition runs per task (${evidence.label})`);
      }
    }
    const mediaLinks = project.media.flatMap((media) => [media.src, media.posterSrc, media.captionSrc].filter(Boolean).map((href) => ({ href })));
    for (const link of [...project.links, ...mediaLinks]) {
      if (!link.href.startsWith('https://')) errors.push(`${project.slug}: public URLs must use HTTPS (${link.href})`);
    }
    for (const media of project.media) {
      if ((media.posterSrc || media.captionSrc || media.captionLanguage || media.captionLabel) && media.kind !== 'video') errors.push(`${project.slug}: accessible video metadata is only valid for video media (${media.label})`);
      if (media.captionSrc && (!media.captionLanguage || !media.captionLabel)) errors.push(`${project.slug}: caption source requires language and label (${media.label})`);
      if (!media.captionSrc && (media.captionLanguage || media.captionLabel)) errors.push(`${project.slug}: caption language and label require a caption source (${media.label})`);
    }
  }

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(serialized)) errors.push(`Forbidden private or credential-like content matched: ${pattern.source}`);
  }
  for (const term of blockedTerms) {
    if (serialized.toLowerCase().includes(term.toLowerCase())) errors.push(`Configured blocked term found: ${term}`);
  }

  return errors;
}
