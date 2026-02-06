#!/usr/bin/env node
/**
 * Experiment Runner
 *
 * Runs coding tasks through different agent workflow conditions:
 *   A: Single agent (plan -> implement -> self-verify)
 *   B: Two-agent (builder + verifier, same prompts)
 *   C: Three-agent Failure-First harness
 *
 * Usage:
 *   node run-experiment.js <task-file> --condition A|B|C [--output <dir>]
 *   node run-experiment.js <task-file> --all [--output <dir>]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function generateRunId() {
  return `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// Simulated agent responses for testing infrastructure
// In production, these would call actual LLM APIs
const SIMULATED_AGENTS = {
  // Single agent typically misses subtle issues
  A: {
    identified_failures: [
      { ground_truth_id: 'GT001', title: 'Missing signature header' },
      { ground_truth_id: 'GT002', title: 'Empty signature header' },
      { ground_truth_id: 'GT005', title: 'Missing secret validation' }
    ],
    verified_failures: [
      { ground_truth_id: 'GT001', title: 'Missing signature header' },
      { ground_truth_id: 'GT002', title: 'Empty signature header' }
    ]
  },
  // Builder + verifier catches a few more
  B: {
    identified_failures: [
      { ground_truth_id: 'GT001', title: 'Missing signature header' },
      { ground_truth_id: 'GT002', title: 'Empty signature header' },
      { ground_truth_id: 'GT005', title: 'Missing secret validation' },
      { ground_truth_id: 'GT006', title: 'Payload type confusion' },
      { ground_truth_id: 'GT010', title: 'Buffer length mismatch' }
    ],
    verified_failures: [
      { ground_truth_id: 'GT001', title: 'Missing signature header' },
      { ground_truth_id: 'GT002', title: 'Empty signature header' },
      { ground_truth_id: 'GT005', title: 'Missing secret validation' },
      { ground_truth_id: 'GT010', title: 'Buffer length mismatch' }
    ]
  },
  // Full harness with adversary catches most
  C: {
    identified_failures: [
      { ground_truth_id: 'GT001', title: 'Missing signature header' },
      { ground_truth_id: 'GT002', title: 'Empty signature header' },
      { ground_truth_id: 'GT003', title: 'Timing attack via string comparison' },
      { ground_truth_id: 'GT004', title: 'Wrong encoding' },
      { ground_truth_id: 'GT005', title: 'Missing secret validation' },
      { ground_truth_id: 'GT006', title: 'Payload type confusion' },
      { ground_truth_id: 'GT008', title: 'Signature prefix bypass' },
      { ground_truth_id: 'GT009', title: 'Case sensitivity issues' },
      { ground_truth_id: 'GT010', title: 'Buffer length mismatch' }
    ],
    verified_failures: [
      { ground_truth_id: 'GT001', title: 'Missing signature header', evidence: 'test passed' },
      { ground_truth_id: 'GT002', title: 'Empty signature header', evidence: 'test passed' },
      { ground_truth_id: 'GT003', title: 'Timing attack', evidence: 'code review: uses timingSafeEqual' },
      { ground_truth_id: 'GT005', title: 'Missing secret validation', evidence: 'test passed' },
      { ground_truth_id: 'GT006', title: 'Payload type confusion', evidence: 'test passed' },
      { ground_truth_id: 'GT008', title: 'Signature prefix bypass', evidence: 'test passed' },
      { ground_truth_id: 'GT009', title: 'Case sensitivity', evidence: 'test passed' },
      { ground_truth_id: 'GT010', title: 'Buffer length mismatch', evidence: 'test passed' }
    ]
  }
};

async function runCondition(task, condition, outputDir) {
  const runId = generateRunId();
  console.log(`Running condition ${condition} (${runId})...`);

  // In production: call LLM APIs here
  // For now: use simulated responses
  const agentResult = SIMULATED_AGENTS[condition];

  if (!agentResult) {
    throw new Error(`Unknown condition: ${condition}`);
  }

  const result = {
    run_id: runId,
    task_id: task.id,
    task_name: task.name,
    condition: condition,
    timestamp: new Date().toISOString(),
    identified_failures: agentResult.identified_failures,
    verified_failures: agentResult.verified_failures,
    metadata: {
      simulated: true,
      note: 'Replace with actual LLM agent calls for real experiments'
    }
  };

  const outputPath = path.join(outputDir, `${runId}.json`);
  saveJSON(outputPath, result);
  console.log(`  Saved: ${outputPath}`);

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Experiment Runner');
    console.log('');
    console.log('Usage:');
    console.log('  node run-experiment.js <task-file> --condition A|B|C');
    console.log('  node run-experiment.js <task-file> --all');
    console.log('');
    console.log('Conditions:');
    console.log('  A: Single agent (plan -> implement -> self-verify)');
    console.log('  B: Two-agent (builder + verifier)');
    console.log('  C: Three-agent Failure-First harness');
    console.log('');
    console.log('Options:');
    console.log('  --output <dir>  Output directory (default: ./results)');
    process.exit(1);
  }

  const taskFile = args[0];
  const task = loadJSON(path.resolve(taskFile));

  let conditions = [];
  let outputDir = path.join(path.dirname(taskFile), '..', 'results');

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--condition' && args[i + 1]) {
      conditions.push(args[i + 1].toUpperCase());
      i++;
    } else if (args[i] === '--all') {
      conditions = ['A', 'B', 'C'];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    }
  }

  if (conditions.length === 0) {
    console.error('Error: No condition specified. Use --condition A|B|C or --all');
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Task: ${task.name}`);
  console.log(`Ground truth failures: ${task.ground_truth_failures.length}`);
  console.log(`Output: ${outputDir}`);
  console.log('');

  const results = [];
  for (const condition of conditions) {
    const result = await runCondition(task, condition, outputDir);
    results.push(result);
  }

  console.log('');
  console.log('=== Summary ===');
  for (const r of results) {
    console.log(`${r.condition}: identified ${r.identified_failures.length}, verified ${r.verified_failures.length}`);
  }

  // Save combined results
  const summaryPath = path.join(outputDir, `experiment-${Date.now()}.json`);
  saveJSON(summaryPath, {
    task: task.id,
    runs: results.map(r => r.run_id),
    timestamp: new Date().toISOString()
  });
  console.log('');
  console.log(`Experiment summary: ${summaryPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
