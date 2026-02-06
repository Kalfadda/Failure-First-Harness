#!/usr/bin/env node
/**
 * Scoring script for experiment results
 *
 * Compares agent-identified failures against ground truth
 * and measures false completion rate and verification accuracy.
 */

const fs = require('fs');
const path = require('path');

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function scoreRun(groundTruth, agentFailures, agentVerified) {
  const gtIds = new Set(groundTruth.map(f => f.id));
  const identifiedIds = new Set(agentFailures.map(f => f.ground_truth_id).filter(Boolean));
  const verifiedIds = new Set(agentVerified.map(f => f.ground_truth_id).filter(Boolean));

  // Coverage: what % of ground truth did agent identify?
  const coverage = identifiedIds.size / gtIds.size;

  // False completion: did agent claim "done" while missing failures?
  const missed = [...gtIds].filter(id => !identifiedIds.has(id));
  const falseCompletionRate = missed.length / gtIds.size;

  // Verification accuracy: of verified claims, how many are actually in ground truth?
  const trueVerified = [...verifiedIds].filter(id => gtIds.has(id));
  const verificationAccuracy = verifiedIds.size > 0
    ? trueVerified.length / verifiedIds.size
    : 0;

  return {
    total_ground_truth: gtIds.size,
    identified: identifiedIds.size,
    verified: verifiedIds.size,
    missed: missed.length,
    coverage: (coverage * 100).toFixed(1) + '%',
    false_completion_rate: (falseCompletionRate * 100).toFixed(1) + '%',
    verification_accuracy: (verificationAccuracy * 100).toFixed(1) + '%',
    missed_failures: missed
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node score.js <task-file> <result-file>');
    console.log('');
    console.log('Example: node score.js tasks/validate-signature.json results/run-001.json');
    process.exit(1);
  }

  const [taskFile, resultFile] = args;

  const task = loadJSON(path.resolve(taskFile));
  const result = loadJSON(path.resolve(resultFile));

  const groundTruth = task.ground_truth_failures;
  const agentFailures = result.identified_failures || [];
  const agentVerified = result.verified_failures || [];

  const score = scoreRun(groundTruth, agentFailures, agentVerified);

  console.log('=== Experiment Score ===');
  console.log(`Task: ${task.name}`);
  console.log(`Condition: ${result.condition || 'unknown'}`);
  console.log('');
  console.log(`Ground truth failures: ${score.total_ground_truth}`);
  console.log(`Agent identified: ${score.identified}`);
  console.log(`Agent verified: ${score.verified}`);
  console.log(`Missed: ${score.missed}`);
  console.log('');
  console.log(`Coverage: ${score.coverage}`);
  console.log(`False completion rate: ${score.false_completion_rate}`);
  console.log(`Verification accuracy: ${score.verification_accuracy}`);

  if (score.missed_failures.length > 0) {
    console.log('');
    console.log('Missed failures:');
    score.missed_failures.forEach(id => {
      const f = groundTruth.find(g => g.id === id);
      console.log(`  - ${id}: ${f ? f.title : 'unknown'}`);
    });
  }

  // Output JSON for programmatic use
  const outputPath = resultFile.replace('.json', '-scored.json');
  fs.writeFileSync(outputPath, JSON.stringify({ task: task.id, ...score }, null, 2));
  console.log('');
  console.log(`Saved to: ${outputPath}`);
}

main();
