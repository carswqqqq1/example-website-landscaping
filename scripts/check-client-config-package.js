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

try {
  execFileSync('node', [path.join(root, 'scripts', 'generate-client-package.js'), absoluteInputPath, packageDir], {
    cwd: root,
    stdio: 'pipe'
  });

  const previewFiles = listFiles(packageDir).filter((filePath) => {
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
    'hello@thinkgreendesignbuild.com'
  ];
  const findings = previewFiles.flatMap((filePath) => assertNoResidue(filePath, forbidden));

  if (findings.length) {
    console.error('Client package still contains demo brand/contact residue:');
    findings.slice(0, 25).forEach((finding) => {
      console.error(`- ${finding.file}: ${finding.term}`);
    });

    if (findings.length > 25) {
      console.error(`- ...and ${findings.length - 25} more`);
    }

    process.exit(1);
  }

  console.log(`Client config package check passed for ${path.relative(root, absoluteInputPath)}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
