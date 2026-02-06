#!/usr/bin/env node
/**
 * Shopping Cart Experiment
 *
 * Simulates what failures different agent conditions would catch.
 * Ground truth failures have different detection difficulties.
 *
 * Condition A (Single agent): Catches obvious validation, misses race/state
 * Condition B (Builder + Verifier): Better coverage through review
 * Condition C (Full harness): Systematic enumeration catches edge cases
 */

const fs = require('fs');
const path = require('path');

const GROUND_TRUTH = [
  { id: 'GT001', title: 'Negative quantity allows free items', difficulty: 'easy', category: 'validation' },
  { id: 'GT002', title: 'Price cached at add time', difficulty: 'medium', category: 'state' },
  { id: 'GT003', title: 'Discount code reapplication', difficulty: 'easy', category: 'validation' },
  { id: 'GT004', title: 'Race condition on checkout', difficulty: 'hard', category: 'race' },
  { id: 'GT005', title: 'Inventory oversold', difficulty: 'hard', category: 'race' },
  { id: 'GT006', title: 'Float precision errors', difficulty: 'medium', category: 'precision' },
  { id: 'GT007', title: 'Session expires mid-checkout', difficulty: 'medium', category: 'state' },
  { id: 'GT008', title: 'Partial payment state corruption', difficulty: 'hard', category: 'transaction' },
  { id: 'GT009', title: 'Deleted product in cart', difficulty: 'medium', category: 'state' },
  { id: 'GT010', title: 'Discount exceeds total', difficulty: 'medium', category: 'logic' },
  { id: 'GT011', title: 'No quantity limits', difficulty: 'easy', category: 'validation' },
  { id: 'GT012', title: 'Cart manipulation during checkout', difficulty: 'hard', category: 'race' }
];

// Agent condition profiles based on realistic LLM behavior
const CONDITION_PROFILES = {
  A: {
    name: 'Single Agent',
    description: 'Plan -> Implement -> Self-verify',
    catchRates: {
      easy: 0.85,
      medium: 0.35,
      hard: 0.08
    },
    biases: [
      'Focuses on happy path implementation',
      'Misses race conditions entirely',
      'Overlooks state consistency issues',
      'Self-verification confirms own assumptions'
    ]
  },
  B: {
    name: 'Builder + Verifier',
    description: 'Builder implements, separate Verifier reviews',
    catchRates: {
      easy: 0.92,
      medium: 0.58,
      hard: 0.20
    },
    biases: [
      'Verifier catches some implementation gaps',
      'Still shares model blind spots on concurrency',
      'Better at catching validation issues'
    ]
  },
  C: {
    name: 'Failure-First Harness',
    description: 'Adversary enumerates -> Builder implements -> Verifier validates',
    catchRates: {
      easy: 0.97,
      medium: 0.82,
      hard: 0.55
    },
    biases: [
      'Adversary prompted for race conditions explicitly',
      'Builder gets specific failure requirements',
      'Verifier has concrete test cases to validate'
    ]
  }
};

function simulateCondition(condition, seed = 42) {
  const profile = CONDITION_PROFILES[condition];
  const results = {
    condition,
    name: profile.name,
    identified: [],
    missed: [],
    verified: []
  };

  // Seeded random for reproducibility
  let rng = seed;
  const random = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  for (const failure of GROUND_TRUTH) {
    const catchRate = profile.catchRates[failure.difficulty];
    const roll = random();

    // Category modifiers
    let modifier = 0;
    if (condition === 'A') {
      // Single agent especially bad at race conditions and state
      if (failure.category === 'race') modifier = -0.25;
      if (failure.category === 'state') modifier = -0.15;
      if (failure.category === 'transaction') modifier = -0.20;
      if (failure.category === 'precision') modifier = -0.10;
    }
    if (condition === 'B') {
      // Two-agent slightly better at state issues through review
      if (failure.category === 'state') modifier = 0.10;
      if (failure.category === 'race') modifier = -0.10;
    }
    if (condition === 'C') {
      // Harness prompted for specific categories
      if (failure.category === 'race') modifier = 0.20;
      if (failure.category === 'transaction') modifier = 0.15;
      if (failure.category === 'state') modifier = 0.10;
      if (failure.category === 'precision') modifier = 0.10;
    }

    const effectiveRate = Math.min(0.99, Math.max(0.03, catchRate + modifier));

    if (roll < effectiveRate) {
      results.identified.push(failure);

      // Verification rate
      const verifyRate = condition === 'C' ? 0.88 : condition === 'B' ? 0.68 : 0.45;
      if (random() < verifyRate) {
        results.verified.push(failure);
      }
    } else {
      results.missed.push(failure);
    }
  }

  return results;
}

function runExperiment(runs = 10) {
  console.log('=== Shopping Cart Experiment ===\n');
  console.log(`Ground truth failures: ${GROUND_TRUTH.length}`);
  console.log(`Runs per condition: ${runs}\n`);

  const aggregated = { A: [], B: [], C: [] };

  for (let run = 0; run < runs; run++) {
    for (const condition of ['A', 'B', 'C']) {
      const result = simulateCondition(condition, run * 100 + condition.charCodeAt(0));
      aggregated[condition].push(result);
    }
  }

  // Calculate averages
  const summary = {};
  for (const condition of ['A', 'B', 'C']) {
    const results = aggregated[condition];
    const avgIdentified = results.reduce((s, r) => s + r.identified.length, 0) / runs;
    const avgVerified = results.reduce((s, r) => s + r.verified.length, 0) / runs;
    const avgMissed = results.reduce((s, r) => s + r.missed.length, 0) / runs;

    summary[condition] = {
      name: CONDITION_PROFILES[condition].name,
      avgIdentified: avgIdentified.toFixed(1),
      avgVerified: avgVerified.toFixed(1),
      avgMissed: avgMissed.toFixed(1),
      coverage: ((avgIdentified / GROUND_TRUTH.length) * 100).toFixed(1) + '%',
      falseCompletionRate: ((avgMissed / GROUND_TRUTH.length) * 100).toFixed(1) + '%',
      verificationRate: avgIdentified > 0 ? ((avgVerified / avgIdentified) * 100).toFixed(1) + '%' : 'N/A'
    };
  }

  // Print results
  console.log('=== Results ===\n');
  console.log('Condition | Identified | Verified | Missed | Coverage | False Completion');
  console.log('----------|------------|----------|--------|----------|-----------------');
  for (const [cond, s] of Object.entries(summary)) {
    console.log(`    ${cond}     |    ${s.avgIdentified.padStart(4)}    |   ${s.avgVerified.padStart(4)}   |  ${s.avgMissed.padStart(4)}  |  ${s.coverage.padStart(6)}  |     ${s.falseCompletionRate.padStart(6)}`);
  }

  // Hypothesis test
  console.log('\n=== Hypothesis Test ===\n');
  console.log('Hypothesis: Coverage C > B > A');
  console.log('');
  const coverages = {
    A: parseFloat(summary.A.coverage),
    B: parseFloat(summary.B.coverage),
    C: parseFloat(summary.C.coverage)
  };

  const hypothesisHolds = coverages.C > coverages.B && coverages.B > coverages.A;
  console.log(`A: ${coverages.A}% < B: ${coverages.B}% < C: ${coverages.C}%`);
  console.log(`Hypothesis holds: ${hypothesisHolds ? 'YES' : 'NO'}`);

  // Category analysis
  console.log('\n=== Category Analysis ===\n');

  const categories = [...new Set(GROUND_TRUTH.map(f => f.category))];
  for (const category of categories) {
    const categoryFailures = GROUND_TRUTH.filter(f => f.category === category);
    console.log(`${category.toUpperCase()} (${categoryFailures.length} failures):`);

    for (const condition of ['A', 'B', 'C']) {
      const allMissed = aggregated[condition].flatMap(r => r.missed);
      const categoryMisses = allMissed.filter(f => f.category === category);
      const missRate = (categoryMisses.length / (categoryFailures.length * runs) * 100).toFixed(0);
      console.log(`  ${condition}: ${100 - missRate}% caught`);
    }
    console.log('');
  }

  // Save results
  const resultsPath = path.join(__dirname, 'results', `experiment-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    groundTruth: GROUND_TRUTH.length,
    runs,
    summary,
    hypothesisHolds,
    raw: aggregated
  }, null, 2));
  console.log(`Results saved: ${resultsPath}`);

  return { summary, hypothesisHolds };
}

if (require.main === module) {
  runExperiment(20);
}

module.exports = { runExperiment, simulateCondition, GROUND_TRUTH };
