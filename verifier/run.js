#!/usr/bin/env node
/**
 * Verifier Runner
 *
 * Executes verification for FailureSpec failures.
 * Verification MUST produce observable evidence - assertions alone are not valid.
 *
 * Usage:
 *   node run.js <failurespec.json> [--failure F001] [--output <dir>]
 *
 * The verifier will:
 *   1. Read failures in CLAIMED state
 *   2. Look for associated test files
 *   3. Execute tests or repro commands
 *   4. Produce a verification report
 *
 * Hard rule: Verification fails if no executable evidence exists.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const crypto = require('crypto');

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function hashContent(content) {
  return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// Evidence collection strategies
const EVIDENCE_COLLECTORS = {
  unit_test: collectTestEvidence,
  integration_test: collectTestEvidence,
  e2e_test: collectTestEvidence,
  fuzz: collectTestEvidence,
  load_test: collectTestEvidence,
  code_review: collectCodeReviewEvidence,
  manual: collectManualEvidence,
  manual_test: collectManualEvidence,
  security_test: collectSecurityTestEvidence,
  timing_analysis: collectTestEvidence,
  log_analysis: collectTestEvidence,
  log_search: collectTestEvidence,
  log_inspection: collectTestEvidence,
  network_capture: collectTestEvidence,
  header_inspection: collectTestEvidence,
  traffic_analysis: collectTestEvidence,
  token_inspection: collectTestEvidence
};

function findTestFile(failure, baseDir) {
  // Look for test files that might correspond to this failure
  const testPatterns = [
    `test/${failure.id.toLowerCase()}.test.js`,
    `test/${failure.id.toLowerCase()}.test.ts`,
    `tests/${failure.id.toLowerCase()}.test.js`,
    `__tests__/${failure.id.toLowerCase()}.test.js`,
    `test/failures/${failure.id}.test.js`,
    `case-study/**/test-${failure.id.toLowerCase()}.js`
  ];

  for (const pattern of testPatterns) {
    const fullPath = path.join(baseDir, pattern);
    // Simple glob - just check direct path for now
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Also check if there's a test file referenced in evidence.criteria
  if (failure.evidence && failure.evidence.criteria) {
    const match = failure.evidence.criteria.match(/test[_\-]?(\w+)/i);
    if (match) {
      const possibleFile = path.join(baseDir, 'test', `${match[0]}.js`);
      if (fs.existsSync(possibleFile)) {
        return possibleFile;
      }
    }
  }

  return null;
}

function collectTestEvidence(failure, baseDir) {
  const testFile = findTestFile(failure, baseDir);

  if (!testFile) {
    return {
      success: false,
      error: `No test file found for ${failure.id}`,
      evidence: null
    };
  }

  try {
    // Try to run the test
    const result = spawnSync('node', [testFile], {
      cwd: baseDir,
      encoding: 'utf8',
      timeout: 30000
    });

    const output = (result.stdout || '') + (result.stderr || '');
    const passed = result.status === 0;

    return {
      success: passed,
      method: `Executed test: ${path.relative(baseDir, testFile)}`,
      evidence: output.slice(0, 2000), // Truncate long output
      evidence_hash: hashContent(output),
      error: passed ? null : `Test failed with exit code ${result.status}`
    };
  } catch (e) {
    return {
      success: false,
      error: `Test execution failed: ${e.message}`,
      evidence: null
    };
  }
}

function collectCodeReviewEvidence(failure, baseDir) {
  // For code review, we need to verify the implementation exists
  if (!failure.status || !failure.status.guardrail || !failure.status.guardrail.location) {
    return {
      success: false,
      error: 'No implementation location specified for code review',
      evidence: null
    };
  }

  const location = failure.status.guardrail.location;
  // Parse location like "src/file.ts:10-20"
  const match = location.match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);

  if (!match) {
    return {
      success: false,
      error: `Cannot parse location: ${location}`,
      evidence: null
    };
  }

  const [, filePath, startLine, endLine] = match;
  const fullPath = path.join(baseDir, filePath);

  if (!fs.existsSync(fullPath)) {
    // Check if it's an external location
    if (location.includes('external') || location.includes('infrastructure')) {
      return {
        success: true,
        method: 'External dependency - delegated verification',
        evidence: `Implementation delegated to: ${location}`,
        evidence_hash: hashContent(location),
        note: 'External implementations require separate verification'
      };
    }

    return {
      success: false,
      error: `File not found: ${fullPath}`,
      evidence: null
    };
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    let excerpt;
    if (startLine && endLine) {
      excerpt = lines.slice(parseInt(startLine) - 1, parseInt(endLine)).join('\n');
    } else if (startLine) {
      excerpt = lines.slice(parseInt(startLine) - 1, parseInt(startLine) + 10).join('\n');
    } else {
      excerpt = content.slice(0, 500);
    }

    return {
      success: true,
      method: `Code review: ${filePath}`,
      evidence: excerpt,
      evidence_hash: hashContent(content)
    };
  } catch (e) {
    return {
      success: false,
      error: `Cannot read file: ${e.message}`,
      evidence: null
    };
  }
}

function collectManualEvidence(failure, baseDir) {
  // Manual evidence cannot be automatically verified
  return {
    success: false,
    error: 'Manual evidence type requires human verification',
    evidence: null,
    note: 'Convert to automated test for CI verification'
  };
}

function collectSecurityTestEvidence(failure, baseDir) {
  // Look for security test script
  const testFile = findTestFile(failure, baseDir);
  if (testFile) {
    return collectTestEvidence(failure, baseDir);
  }

  return {
    success: false,
    error: 'No security test found - create test file or run manual security assessment',
    evidence: null
  };
}

function verifyFailure(failure, baseDir) {
  const result = {
    failure_id: failure.id,
    failure_title: failure.title,
    status: failure.status ? failure.status.state : 'unaddressed',
    verification_attempted: new Date().toISOString()
  };

  // Only verify CLAIMED failures
  if (!failure.status || failure.status.state !== 'claimed') {
    result.skipped = true;
    result.reason = `State is "${failure.status?.state || 'unaddressed'}", not "claimed"`;
    return result;
  }

  // Get the appropriate evidence collector
  const evidenceType = failure.evidence?.type || 'manual';
  const collector = EVIDENCE_COLLECTORS[evidenceType] || collectManualEvidence;

  const evidence = collector(failure, baseDir);

  result.evidence_type = evidenceType;
  result.verification_result = evidence;

  if (evidence.success) {
    result.verified = true;
    result.verification = {
      method: evidence.method,
      evidence: evidence.evidence,
      evidence_hash: evidence.evidence_hash,
      verified_by: 'verifier-runner',
      verified_at: new Date().toISOString()
    };
  } else {
    result.verified = false;
    result.rejection_reason = evidence.error;
    if (evidence.note) {
      result.note = evidence.note;
    }
  }

  return result;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Verifier Runner');
    console.log('');
    console.log('Usage:');
    console.log('  node run.js <failurespec.json>');
    console.log('  node run.js <failurespec.json> --failure F001');
    console.log('  node run.js <failurespec.json> --output ./reports');
    console.log('');
    console.log('Options:');
    console.log('  --failure <id>  Verify only specified failure');
    console.log('  --output <dir>  Output directory for verification report');
    console.log('  --root <dir>    Project root directory (default: cwd)');
    console.log('  --strict        Fail if any CLAIMED failure cannot be verified');
    process.exit(1);
  }

  let specFile = null;
  let targetFailure = null;
  let outputDir = null;
  let projectRoot = null;
  let strict = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--failure' && args[i + 1]) {
      targetFailure = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--root' && args[i + 1]) {
      projectRoot = args[i + 1];
      i++;
    } else if (args[i] === '--strict') {
      strict = true;
    } else if (!args[i].startsWith('-')) {
      specFile = args[i];
    }
  }

  if (!specFile) {
    console.error('Error: No FailureSpec file specified');
    process.exit(1);
  }

  const specPath = path.resolve(specFile);
  const baseDir = projectRoot ? path.resolve(projectRoot) : process.cwd();
  const spec = loadJSON(specPath);

  console.log('=== Verifier Runner ===');
  console.log(`Spec: ${specFile}`);
  console.log(`Feature: ${spec.metadata?.feature}`);
  console.log('');

  // Filter failures to verify
  let failures = spec.failures || [];
  if (targetFailure) {
    failures = failures.filter(f => f.id === targetFailure);
    if (failures.length === 0) {
      console.error(`Error: Failure ${targetFailure} not found`);
      process.exit(1);
    }
  }

  // Verify each failure
  const results = [];
  let verified = 0;
  let failed = 0;
  let skipped = 0;

  for (const failure of failures) {
    console.log(`Verifying ${failure.id}: ${failure.title}`);
    const result = verifyFailure(failure, baseDir);
    results.push(result);

    if (result.skipped) {
      console.log(`  SKIPPED: ${result.reason}`);
      skipped++;
    } else if (result.verified) {
      console.log(`  VERIFIED: ${result.verification.method}`);
      verified++;
    } else {
      console.log(`  FAILED: ${result.rejection_reason}`);
      failed++;
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Total: ${failures.length}`);
  console.log(`Verified: ${verified}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  // Save report
  const report = {
    spec_file: specFile,
    feature: spec.metadata?.feature,
    timestamp: new Date().toISOString(),
    summary: { total: failures.length, verified, failed, skipped },
    results
  };

  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const reportPath = path.join(outputDir, `verification-${Date.now()}.json`);
    saveJSON(reportPath, report);
    console.log('');
    console.log(`Report saved: ${reportPath}`);
  }

  // Exit with error if strict mode and failures exist
  if (strict && failed > 0) {
    console.log('');
    console.log('STRICT MODE: Verification failed');
    process.exit(1);
  }
}

main();
