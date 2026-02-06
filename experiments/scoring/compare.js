#!/usr/bin/env node
/**
 * Compare experiment results across conditions
 *
 * Usage: node compare.js results/*-scored.json
 */

const fs = require('fs');
const path = require('path');

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node compare.js <scored-result-files...>');
    console.log('');
    console.log('Example: node compare.js results/*-scored.json');
    process.exit(1);
  }

  const results = args.map(f => {
    const data = loadJSON(path.resolve(f));
    // Extract condition from the original result file
    const originalFile = f.replace('-scored.json', '.json');
    let condition = 'unknown';
    try {
      const original = loadJSON(path.resolve(originalFile));
      condition = original.condition || 'unknown';
    } catch (e) {
      // Try to infer from data
    }
    return { file: f, condition, ...data };
  });

  // Sort by condition
  results.sort((a, b) => a.condition.localeCompare(b.condition));

  console.log('=== Experiment Comparison ===');
  console.log('');
  console.log('Condition | Coverage | False Completion | Verification Accuracy | Missed');
  console.log('----------|----------|------------------|----------------------|-------');

  for (const r of results) {
    console.log(
      `    ${r.condition}     |  ${r.coverage.padStart(6)} |      ${r.false_completion_rate.padStart(6)}       |        ${r.verification_accuracy.padStart(6)}          |   ${r.missed}`
    );
  }

  console.log('');
  console.log('Hypothesis: D > C > B > A for coverage');
  console.log('');

  // Calculate if hypothesis holds
  const byCondition = {};
  for (const r of results) {
    byCondition[r.condition] = parseFloat(r.coverage);
  }

  const conditionOrder = ['A', 'B', 'C', 'D'];
  let hypothesisHolds = true;
  let prevCoverage = -1;

  for (const c of conditionOrder) {
    if (byCondition[c] !== undefined) {
      if (byCondition[c] < prevCoverage) {
        hypothesisHolds = false;
      }
      prevCoverage = byCondition[c];
    }
  }

  console.log(`Hypothesis holds: ${hypothesisHolds ? 'YES' : 'NO'}`);
}

main();
