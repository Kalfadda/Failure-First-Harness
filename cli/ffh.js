#!/usr/bin/env node
/**
 * ffh - Failure-First Harness CLI
 *
 * Minimal CLI for managing the failure-first development lifecycle.
 *
 * Commands:
 *   init          Create .failure-first directory
 *   freeze        Freeze the spec (no more changes)
 *   status        Show state of all failures
 *   claim         Mark failure as claimed by builder
 *   verify        Verify a failure with evidence
 *   reject        Reject a claimed failure
 *   accept-risk   Accept risk (requires human authority)
 *   discover      Log a discovered failure
 *   report        Generate status report
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FFH_DIR = '.failure-first';
const FAILURES_FILE = 'failures.json';
const DISCOVERIES_FILE = 'discoveries.json';

// Utility functions
function getFFHPath() {
  return path.join(process.cwd(), FFH_DIR);
}

function getFailuresPath() {
  return path.join(getFFHPath(), FAILURES_FILE);
}

function getDiscoveriesPath() {
  return path.join(getFFHPath(), DISCOVERIES_FILE);
}

function loadJSON(filepath) {
  if (!fs.existsSync(filepath)) {
    return null;
  }
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

function ensureInitialized() {
  if (!fs.existsSync(getFFHPath())) {
    console.error('Error: Not a failure-first project. Run `ffh init` first.');
    process.exit(1);
  }
}

function loadSpec() {
  const spec = loadJSON(getFailuresPath());
  if (!spec) {
    console.error('Error: No failures.json found');
    process.exit(1);
  }
  return spec;
}

function saveSpec(spec) {
  saveJSON(getFailuresPath(), spec);
}

function findFailure(spec, id) {
  const upperId = id.toUpperCase();
  return spec.failures.find(f => f.id === upperId);
}

// Commands
const commands = {
  init() {
    const ffhPath = getFFHPath();

    if (fs.existsSync(ffhPath)) {
      console.log('Already initialized.');
      return;
    }

    fs.mkdirSync(ffhPath, { recursive: true });

    // Create empty spec
    const spec = {
      $schema: 'https://failurespec.org/v1/schema.json',
      version: '1.0',
      metadata: {
        feature: 'Unnamed feature',
        created_by: process.env.USER || 'unknown',
        frozen_at: null,
        frozen_commit: null
      },
      failures: []
    };
    saveJSON(getFailuresPath(), spec);

    // Create empty discoveries
    const discoveries = { discoveries: [] };
    saveJSON(getDiscoveriesPath(), discoveries);

    console.log('Initialized failure-first harness in', ffhPath);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit .failure-first/failures.json to add failures');
    console.log('  2. Run `ffh freeze` when adversary phase is complete');
  },

  freeze() {
    ensureInitialized();
    const spec = loadSpec();

    if (spec.metadata.frozen_at) {
      console.error(`Error: Spec already frozen at ${spec.metadata.frozen_at}`);
      process.exit(1);
    }

    if (spec.failures.length === 0) {
      console.error('Error: No failures defined. Add failures before freezing.');
      process.exit(1);
    }

    spec.metadata.frozen_at = new Date().toISOString();
    spec.metadata.frozen_commit = getGitCommit();

    saveSpec(spec);

    console.log('Spec frozen.');
    console.log(`  Timestamp: ${spec.metadata.frozen_at}`);
    console.log(`  Commit: ${spec.metadata.frozen_commit || '(not in git)'}`);
    console.log(`  Failures: ${spec.failures.length}`);
    console.log('');
    console.log('The spec is now frozen. Use `ffh discover` for new findings.');
  },

  status(args) {
    ensureInitialized();
    const spec = loadSpec();

    const showAll = args.includes('--all');

    console.log(`Feature: ${spec.metadata.feature}`);
    console.log(`Frozen: ${spec.metadata.frozen_at ? 'Yes (' + spec.metadata.frozen_at + ')' : 'No'}`);
    console.log('');

    // Count by state
    const states = {
      unaddressed: [],
      in_progress: [],
      claimed: [],
      verified: [],
      rejected: [],
      accepted_risk: []
    };

    for (const f of spec.failures) {
      const state = f.status?.state || 'unaddressed';
      if (states[state]) {
        states[state].push(f);
      }
    }

    console.log('=== Summary ===');
    console.log(`Total: ${spec.failures.length}`);
    console.log(`Unaddressed: ${states.unaddressed.length}`);
    console.log(`In Progress: ${states.in_progress.length}`);
    console.log(`Claimed: ${states.claimed.length}`);
    console.log(`Verified: ${states.verified.length}`);
    console.log(`Rejected: ${states.rejected.length}`);
    console.log(`Accepted Risk: ${states.accepted_risk.length}`);

    if (showAll || args.includes('--details')) {
      console.log('');
      console.log('=== Failures ===');
      for (const f of spec.failures) {
        const state = f.status?.state || 'unaddressed';
        const stateIcon = {
          unaddressed: '[ ]',
          in_progress: '[~]',
          claimed: '[?]',
          verified: '[✓]',
          rejected: '[✗]',
          accepted_risk: '[!]'
        }[state] || '[ ]';

        console.log(`${stateIcon} ${f.id}: ${f.title} (${f.severity})`);
      }
    }

    // Show critical unaddressed
    const criticalUnaddressed = states.unaddressed.filter(f => f.severity === 'critical');
    if (criticalUnaddressed.length > 0 && !showAll) {
      console.log('');
      console.log('=== Critical Unaddressed ===');
      for (const f of criticalUnaddressed) {
        console.log(`  ${f.id}: ${f.title}`);
      }
    }
  },

  claim(args) {
    ensureInitialized();
    const spec = loadSpec();

    const failureId = args[0];
    if (!failureId) {
      console.error('Usage: ffh claim <failure-id> [--design "..."] [--location "..."]');
      process.exit(1);
    }

    const failure = findFailure(spec, failureId);
    if (!failure) {
      console.error(`Error: Failure ${failureId} not found`);
      process.exit(1);
    }

    // Parse optional args
    let design = null;
    let location = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--design' && args[i + 1]) {
        design = args[i + 1];
        i++;
      } else if (args[i] === '--location' && args[i + 1]) {
        location = args[i + 1];
        i++;
      }
    }

    // Update status
    failure.status = failure.status || {};
    failure.status.state = 'claimed';
    failure.status.guardrail = {
      design: design || failure.status.guardrail?.design || 'Not specified',
      location: location || failure.status.guardrail?.location || 'Not specified',
      implemented_by: process.env.USER || 'builder',
      implemented_at: new Date().toISOString()
    };

    saveSpec(spec);

    console.log(`${failure.id} marked as CLAIMED`);
    console.log(`  Design: ${failure.status.guardrail.design}`);
    console.log(`  Location: ${failure.status.guardrail.location}`);
  },

  verify(args) {
    ensureInitialized();
    const spec = loadSpec();

    const failureId = args[0];
    if (!failureId) {
      console.error('Usage: ffh verify <failure-id> --evidence "..."');
      process.exit(1);
    }

    const failure = findFailure(spec, failureId);
    if (!failure) {
      console.error(`Error: Failure ${failureId} not found`);
      process.exit(1);
    }

    if (failure.status?.state !== 'claimed') {
      console.error(`Error: ${failureId} is not in CLAIMED state (current: ${failure.status?.state || 'unaddressed'})`);
      process.exit(1);
    }

    // Parse evidence
    let evidence = null;
    let method = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--evidence' && args[i + 1]) {
        evidence = args[i + 1];
        i++;
      } else if (args[i] === '--method' && args[i + 1]) {
        method = args[i + 1];
        i++;
      }
    }

    if (!evidence) {
      console.error('Error: --evidence is required');
      console.error('');
      console.error('Verification requires concrete evidence, not assertions.');
      console.error('Examples:');
      console.error('  --evidence "test_rate_limiter passed in test/f001.test.js"');
      console.error('  --evidence "curl returned 401 for unsigned request"');
      process.exit(1);
    }

    // Update status
    failure.status.state = 'verified';
    failure.status.verification = {
      method: method || 'Manual verification',
      evidence: evidence,
      evidence_hash: 'sha256:' + require('crypto').createHash('sha256').update(evidence).digest('hex').slice(0, 16),
      verified_by: process.env.USER || 'verifier',
      verified_at: new Date().toISOString()
    };

    saveSpec(spec);

    console.log(`${failure.id} marked as VERIFIED`);
    console.log(`  Evidence: ${evidence}`);
  },

  reject(args) {
    ensureInitialized();
    const spec = loadSpec();

    const failureId = args[0];
    if (!failureId) {
      console.error('Usage: ffh reject <failure-id> --reason "..."');
      process.exit(1);
    }

    const failure = findFailure(spec, failureId);
    if (!failure) {
      console.error(`Error: Failure ${failureId} not found`);
      process.exit(1);
    }

    if (failure.status?.state !== 'claimed') {
      console.error(`Error: ${failureId} is not in CLAIMED state`);
      process.exit(1);
    }

    // Parse reason
    let reason = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--reason' && args[i + 1]) {
        reason = args[i + 1];
        i++;
      }
    }

    if (!reason) {
      console.error('Error: --reason is required');
      process.exit(1);
    }

    // Reset to unaddressed
    failure.status.state = 'unaddressed';
    failure.status.rejection = {
      reason: reason,
      rejected_by: process.env.USER || 'verifier',
      rejected_at: new Date().toISOString()
    };

    saveSpec(spec);

    console.log(`${failure.id} REJECTED, returned to UNADDRESSED`);
    console.log(`  Reason: ${reason}`);
  },

  'accept-risk'(args) {
    ensureInitialized();
    const spec = loadSpec();

    const failureId = args[0];
    if (!failureId) {
      console.error('Usage: ffh accept-risk <failure-id> --reason "..." --by "human@example.com"');
      process.exit(1);
    }

    const failure = findFailure(spec, failureId);
    if (!failure) {
      console.error(`Error: Failure ${failureId} not found`);
      process.exit(1);
    }

    // Parse args
    let reason = null;
    let acceptedBy = null;
    let reviewBy = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--reason' && args[i + 1]) {
        reason = args[i + 1];
        i++;
      } else if (args[i] === '--by' && args[i + 1]) {
        acceptedBy = args[i + 1];
        i++;
      } else if (args[i] === '--review-by' && args[i + 1]) {
        reviewBy = args[i + 1];
        i++;
      }
    }

    if (!reason || !acceptedBy) {
      console.error('Error: --reason and --by are required');
      console.error('');
      console.error('Risk acceptance requires human authority.');
      console.error('The --by value must identify a responsible human.');
      process.exit(1);
    }

    // Check for agent identifiers
    const agentPatterns = ['agent', 'bot', 'ai', 'claude', 'gpt', 'assistant'];
    const byLower = acceptedBy.toLowerCase();
    if (agentPatterns.some(p => byLower.includes(p))) {
      console.error('Error: Risk acceptance must be by a human, not an agent');
      process.exit(1);
    }

    // Update status
    failure.status = failure.status || {};
    failure.status.state = 'accepted_risk';
    failure.status.risk_acceptance = {
      reason: reason,
      accepted_by: acceptedBy,
      accepted_at: new Date().toISOString(),
      review_by: reviewBy || null
    };

    saveSpec(spec);

    console.log(`${failure.id} marked as ACCEPTED_RISK`);
    console.log(`  Reason: ${reason}`);
    console.log(`  Accepted by: ${acceptedBy}`);
    if (reviewBy) {
      console.log(`  Review by: ${reviewBy}`);
    }
  },

  discover(args) {
    ensureInitialized();

    const description = args.join(' ');
    if (!description) {
      console.error('Usage: ffh discover "description of discovered failure"');
      process.exit(1);
    }

    const discoveries = loadJSON(getDiscoveriesPath()) || { discoveries: [] };

    // Generate ID
    const nextNum = discoveries.discoveries.length + 1;
    const id = `D${String(nextNum).padStart(3, '0')}`;

    discoveries.discoveries.push({
      id: id,
      description: description,
      discovered_by: process.env.USER || 'unknown',
      discovered_at: new Date().toISOString(),
      disposition: 'pending'
    });

    saveJSON(getDiscoveriesPath(), discoveries);

    console.log(`Discovery logged: ${id}`);
    console.log(`  Description: ${description}`);
    console.log('');
    console.log('Use `ffh discoveries` to see all pending discoveries.');
  },

  discoveries() {
    ensureInitialized();
    const discoveries = loadJSON(getDiscoveriesPath()) || { discoveries: [] };

    if (discoveries.discoveries.length === 0) {
      console.log('No discoveries logged.');
      return;
    }

    console.log('=== Discoveries ===');
    for (const d of discoveries.discoveries) {
      const icon = {
        pending: '[?]',
        add_to_next: '[+]',
        accepted_risk: '[!]',
        duplicate: '[=]'
      }[d.disposition] || '[?]';

      console.log(`${icon} ${d.id}: ${d.description}`);
      console.log(`    Discovered by: ${d.discovered_by} at ${d.discovered_at}`);
    }
  },

  report() {
    ensureInitialized();
    const spec = loadSpec();
    const discoveries = loadJSON(getDiscoveriesPath()) || { discoveries: [] };

    console.log('# Failure-First Status Report');
    console.log('');
    console.log(`**Feature:** ${spec.metadata.feature}`);
    console.log(`**Generated:** ${new Date().toISOString()}`);
    console.log(`**Frozen:** ${spec.metadata.frozen_at || 'No'}`);
    console.log('');

    // Summary
    const states = {};
    for (const f of spec.failures) {
      const state = f.status?.state || 'unaddressed';
      states[state] = (states[state] || 0) + 1;
    }

    console.log('## Summary');
    console.log('');
    console.log(`| State | Count |`);
    console.log(`|-------|-------|`);
    for (const [state, count] of Object.entries(states)) {
      console.log(`| ${state} | ${count} |`);
    }
    console.log('');

    // Critical failures
    const critical = spec.failures.filter(f => f.severity === 'critical');
    if (critical.length > 0) {
      console.log('## Critical Failures');
      console.log('');
      for (const f of critical) {
        const state = f.status?.state || 'unaddressed';
        console.log(`- **${f.id}**: ${f.title} [${state}]`);
      }
      console.log('');
    }

    // Pending discoveries
    const pending = discoveries.discoveries.filter(d => d.disposition === 'pending');
    if (pending.length > 0) {
      console.log('## Pending Discoveries');
      console.log('');
      for (const d of pending) {
        console.log(`- **${d.id}**: ${d.description}`);
      }
      console.log('');
    }
  },

  help() {
    console.log('ffh - Failure-First Harness CLI');
    console.log('');
    console.log('Usage: ffh <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  init                    Create .failure-first directory');
    console.log('  freeze                  Freeze the spec');
    console.log('  status [--all]          Show failure status summary');
    console.log('  claim <id>              Mark failure as claimed');
    console.log('  verify <id> --evidence  Verify failure with evidence');
    console.log('  reject <id> --reason    Reject a claimed failure');
    console.log('  accept-risk <id>        Accept risk (human authority required)');
    console.log('  discover "desc"         Log a discovered failure');
    console.log('  discoveries             List all discoveries');
    console.log('  report                  Generate markdown status report');
    console.log('  help                    Show this help');
  }
};

// Main
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const commandArgs = args.slice(1);

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error('Run `ffh help` for usage.');
    process.exit(1);
  }

  handler(commandArgs);
}

main();
