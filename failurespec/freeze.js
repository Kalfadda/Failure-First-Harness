#!/usr/bin/env node
/**
 * FailureSpec Freeze
 *
 * Freezes a FailureSpec, recording the timestamp and optionally git commit.
 * Once frozen, the spec should not be modified (discoveries go to separate file).
 *
 * Usage:
 *   node freeze.js <failurespec.json>
 *   node freeze.js <failurespec.json> --commit <git-sha>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function getGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function validateBeforeFreeze(spec) {
  const errors = [];

  if (!spec.version || spec.version !== '1.0') {
    errors.push('Invalid or missing version');
  }

  if (!spec.metadata || !spec.metadata.feature) {
    errors.push('Missing metadata.feature');
  }

  if (spec.metadata && spec.metadata.frozen_at) {
    errors.push(`Spec is already frozen (${spec.metadata.frozen_at})`);
  }

  if (!spec.failures || spec.failures.length === 0) {
    errors.push('No failures defined');
  }

  // Check all failures have required fields
  if (spec.failures) {
    for (let i = 0; i < spec.failures.length; i++) {
      const f = spec.failures[i];
      if (!f.id || !f.title || !f.severity || !f.oracle || !f.repro || !f.evidence) {
        errors.push(`Failure ${f.id || i} is missing required fields`);
      }
    }
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('FailureSpec Freeze');
    console.log('');
    console.log('Usage:');
    console.log('  node freeze.js <failurespec.json>');
    console.log('  node freeze.js <failurespec.json> --commit <git-sha>');
    console.log('');
    console.log('Options:');
    console.log('  --commit <sha>  Specify git commit (auto-detected if not provided)');
    console.log('  --force         Freeze even with warnings');
    process.exit(1);
  }

  let filepath = null;
  let commitSha = null;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--commit' && args[i + 1]) {
      commitSha = args[i + 1];
      i++;
    } else if (args[i] === '--force') {
      force = true;
    } else if (!args[i].startsWith('-')) {
      filepath = args[i];
    }
  }

  if (!filepath) {
    console.error('Error: No file specified');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filepath);
  const spec = loadJSON(resolvedPath);

  // Validate before freezing
  const errors = validateBeforeFreeze(spec);
  if (errors.length > 0) {
    console.error('Cannot freeze spec:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  // Get git commit if not provided
  if (!commitSha) {
    commitSha = getGitCommit();
  }

  // Freeze the spec
  const frozenAt = new Date().toISOString();
  spec.metadata.frozen_at = frozenAt;
  spec.metadata.frozen_commit = commitSha;

  // Save
  saveJSON(resolvedPath, spec);

  console.log('Spec frozen successfully');
  console.log('');
  console.log(`  File: ${filepath}`);
  console.log(`  Frozen at: ${frozenAt}`);
  console.log(`  Commit: ${commitSha || '(not in git repo)'}`);
  console.log(`  Failures: ${spec.failures.length}`);
  console.log('');
  console.log('The spec is now frozen. New findings should go to discoveries.json');
}

main();
