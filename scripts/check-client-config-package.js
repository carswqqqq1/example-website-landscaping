#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();
const inputPath = process.argv[2] || path.join('docs', 'client-config-template.json');
const absoluteInputPath = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landscape-client-config-'));
const packageDir = path.join(tempDir, 'package');

function findGeneratedBuildDir(outputDir) {
  const children = fs.readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(outputDir, entry.name));

  if (children.length !== 1) {
    throw new Error(`Expected exactly one generated client build directory, found ${children.length}`);
  }

  return children[0];
}

function listFiles(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      listFiles(entryPath, files);
      return;
    }

    files.push(entryPath);
  });

  return files;
}

function assertNoResidue(filePath, forbidden) {
  const text = fs.readFileSync(filePath, 'utf8');
  return forbidden
    .filter((term) => text.includes(term))
    .map((term) => ({
      file: path.relative(root, filePath),
      term
    }));
}

function assertIncludes(filePath, requiredTerms) {
  const text = fs.readFileSync(filePath, 'utf8');
  return requiredTerms
    .filter((term) => !text.includes(term))
    .map((term) => ({
      file: path.relative(root, filePath),
      term
    }));
}

try {
  execFileSync('node', [path.join(root, 'scripts', 'generate-client-package.js'), absoluteInputPath, packageDir], {
    cwd: root,
    stdio: 'pipe'
  });

  const buildDir = findGeneratedBuildDir(packageDir);
  const previewFiles = listFiles(buildDir).filter((filePath) => {
    return ['.json', '.md', '.txt'].includes(path.extname(filePath));
  });
  const forbidden = [
    'Think Green Design | Build Landscape',
    'Think Green',
    'Think+Green',
    'Think%20Green',
    'thinkgreendesignbuild.com',
    '4809229497',
    '(480) 922-9497',
    'hello@thinkgreendesignbuild.com',
    'Netlify',
    'netlify',
    'NETLIFY_'
  ];
  const findings = previewFiles.flatMap((filePath) => assertNoResidue(filePath, forbidden));

  if (findings.length) {
    console.error('Client package still contains demo brand/contact or retired hosting residue:');
    findings.slice(0, 25).forEach((finding) => {
      console.error(`- ${finding.file}: ${finding.term}`);
    });

    if (findings.length > 25) {
      console.error(`- ...and ${findings.length - 25} more`);
    }

    process.exit(1);
  }

  const requiredFiles = [
    'client-summary.md',
    'competitor-positioning-checklist.md',
    'launch-checklist.md',
    'merged-site-config-preview.json',
    'cloudflare-env-template.txt',
    'service-conversion-plan.md',
    'service-content-overrides-starter.json'
  ];
  const missingFiles = requiredFiles.filter((fileName) => !fs.existsSync(path.join(buildDir, fileName)));
  if (missingFiles.length) {
    console.error('Client package is missing required launch files:');
    missingFiles.forEach((fileName) => console.error(`- ${fileName}`));
    process.exit(1);
  }

  const conversionPlanFindings = assertIncludes(path.join(buildDir, 'service-conversion-plan.md'), [
    'Service Conversion Plan',
    'Global Offer Check',
    'Price drivers to confirm',
    'Quote-prep questions to ask',
    'Proof blurbs to replace with verified client proof',
    'What job size should the client accept, decline, or refer out?'
  ]);
  const summaryFindings = assertIncludes(path.join(buildDir, 'client-summary.md'), [
    'Suggested Cloudflare Pages Project',
    'wrangler pages deploy',
    'apply-service-content-overrides.js',
    'service-content-overrides-starter.json'
  ]);
  const envFindings = assertIncludes(path.join(buildDir, 'cloudflare-env-template.txt'), [
    'SITE_URL=',
    'OWNER_EMAIL=',
    'TURNSTILE_SECRET_KEY=',
    'RESEND_API_KEY=',
    'RESEND_FROM_EMAIL=',
    'GOOGLE_SHEETS_WEBHOOK_URL=',
    'GOOGLE_SHEETS_WEBHOOK_SECRET='
  ]);
  const starterFindings = assertIncludes(path.join(buildDir, 'service-content-overrides-starter.json'), [
    'serviceContentOverrides',
    'pricingDrivers',
    'quotePrep',
    'proofBlurbs',
    'featuredProject',
    'photoNotes'
  ]);
  const competitorFindings = assertIncludes(path.join(buildDir, 'competitor-positioning-checklist.md'), [
    'Competitor Positioning Checklist',
    'Portfolio Depth',
    'Process Model',
    'Budget Confidence',
    'Human and Trust Proof',
    'Financing and Large-Project Fit',
    'Local Market Position'
  ]);

  if (conversionPlanFindings.length || summaryFindings.length || envFindings.length || starterFindings.length || competitorFindings.length) {
    console.error('Client package launch files are incomplete:');
    conversionPlanFindings.concat(summaryFindings, envFindings, starterFindings, competitorFindings).forEach((finding) => {
      console.error(`- ${finding.file}: missing "${finding.term}"`);
    });
    process.exit(1);
  }

  console.log(`Client config package check passed for ${path.relative(root, absoluteInputPath)}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
