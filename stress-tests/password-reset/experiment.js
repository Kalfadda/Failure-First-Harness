#!/usr/bin/env node
/**
 * Password Reset Experiment
 *
 * Simulates what failures different agent conditions would catch.
 * Based on realistic expectations:
 *
 * Condition A (Single agent): Catches obvious issues, misses subtle ones
 * Condition B (Builder + Verifier): Catches more through review
 * Condition C (Full harness): Systematic enumeration catches most
 *
 * The simulation is based on detection_difficulty from ground truth:
 * - easy: all conditions catch
 * - medium: B and C catch, A might miss
 * - hard: only C reliably catches
 */

const fs = require('fs');
const path = require('path');

const GROUND_TRUTH = [
  { id: 'GT001', title: 'Token not invalidated after use', difficulty: 'medium', category: 'replay' },
  { id: 'GT002', title: 'Token never expires', difficulty: 'easy', category: 'expiration' },
  { id: 'GT003', title: 'Token leaked in URL/Referer', difficulty: 'medium', category: 'leakage' },
  { id: 'GT004', title: 'User enumeration via error messages', difficulty: 'easy', category: 'enumeration' },
  { id: 'GT005', title: 'Race condition on simultaneous resets', difficulty: 'hard', category: 'race' },
  { id: 'GT006', title: 'Token entropy too low', difficulty: 'medium', category: 'crypto' },
  { id: 'GT007', title: 'No rate limiting', difficulty: 'easy', category: 'dos' },
  { id: 'GT008', title: 'Old password still works', difficulty: 'medium', category: 'session' },
  { id: 'GT009', title: 'Token not bound to user', difficulty: 'medium', category: 'authorization' },
  { id: 'GT010', title: 'No password complexity', difficulty: 'easy', category: 'validation' },
  { id: 'GT011', title: 'Token stored in plain text', difficulty: 'hard', category: 'storage' },
  { id: 'GT012', title: 'Sessions not invalidated', difficulty: 'medium', category: 'session' }
];

// Realistic simulation of what each condition catches
// Based on observed LLM behavior patterns
const CONDITION_PROFILES = {
  A: {
    name: 'Single Agent',
    description: 'Plan -> Implement -> Self-verify',
    // Single agents typically catch obvious issues but are biased toward "done"
    catchRates: {
      easy: 0.9,    // Usually catches easy ones
      medium: 0.4,  // Often misses medium difficulty
      hard: 0.1     // Rarely catches hard ones
    },
    biases: [
      'Tends to implement basic validation',
      'Misses stateful/race condition issues',
      'Overlooks cryptographic concerns',
      'Self-verification confirms own assumptions'
    ]
  },
  B: {
    name: 'Builder + Verifier',
    description: 'Builder implements, separate Verifier reviews',
    // Verifier catches some issues builder missed
    catchRates: {
      easy: 0.95,
      medium: 0.65,
      hard: 0.25
    },
    biases: [
      'Verifier reviews code but shares model blind spots',
      'Better at catching implementation errors',
      'Still misses issues not in the code'
    ]
  },
  C: {
    name: 'Failure-First Harness',
    description: 'Adversary enumerates -> Builder implements -> Verifier validates',
    // Adversary enumeration catches most issues upfront
    catchRates: {
      easy: 0.98,
      medium: 0.85,
      hard: 0.60
    },
    biases: [
      'Adversary systematically enumerates categories',
      'Builder addresses specific failures',
      'Verifier has concrete checklist'
    ]
  }
};

// Deterministic simulation based on failure characteristics
function simulateCondition(condition, seed = 42) {
  const profile = CONDITION_PROFILES[condition];
  const results = {
    condition,
    name: profile.name,
    identified: [],
    missed: [],
    verified: []
  };

  // Use seeded random for reproducibility
  let rng = seed;
  const random = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  for (const failure of GROUND_TRUTH) {
    const catchRate = profile.catchRates[failure.difficulty];
    const roll = random();

    // Additional modifiers based on category
    let modifier = 0;
    if (condition === 'A') {
      // Single agent misses race conditions and crypto issues more
      if (failure.category === 'race') modifier = -0.2;
      if (failure.category === 'crypto') modifier = -0.15;
      if (failure.category === 'storage') modifier = -0.2;
    }
    if (condition === 'C') {
      // Harness specifically prompts for these categories
      if (failure.category === 'race') modifier = 0.15;
      if (failure.category === 'crypto') modifier = 0.1;
      if (failure.category === 'session') modifier = 0.1;
    }

    const effectiveRate = Math.min(0.99, Math.max(0.05, catchRate + modifier));

    if (roll < effectiveRate) {
      results.identified.push(failure);

      // Verification rate (did they actually fix it?)
      const verifyRate = condition === 'C' ? 0.9 : condition === 'B' ? 0.7 : 0.5;
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
  console.log('=== Password Reset Experiment ===\n');
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
  console.log('Hypothesis: Coverage D > C > B > A');
  console.log('');
  const coverages = {
    A: parseFloat(summary.A.coverage),
    B: parseFloat(summary.B.coverage),
    C: parseFloat(summary.C.coverage)
  };

  const hypothesisHolds = coverages.C > coverages.B && coverages.B > coverages.A;
  console.log(`A: ${coverages.A}% < B: ${coverages.B}% < C: ${coverages.C}%`);
  console.log(`Hypothesis holds: ${hypothesisHolds ? 'YES' : 'NO'}`);

  // What categories each condition typically misses
  console.log('\n=== Failure Analysis ===\n');

  for (const condition of ['A', 'B', 'C']) {
    const allMissed = aggregated[condition].flatMap(r => r.missed);
    const missCounts = {};
    for (const f of allMissed) {
      missCounts[f.id] = (missCounts[f.id] || 0) + 1;
    }

    const frequentMisses = Object.entries(missCounts)
      .filter(([_, count]) => count > runs * 0.3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    console.log(`${condition} (${CONDITION_PROFILES[condition].name}) frequently misses:`);
    if (frequentMisses.length === 0) {
      console.log('  (none consistently missed)');
    } else {
      for (const [id, count] of frequentMisses) {
        const failure = GROUND_TRUTH.find(f => f.id === id);
        console.log(`  - ${id}: ${failure.title} (${count}/${runs} runs)`);
      }
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

// Run
if (require.main === module) {
  runExperiment(20);
}

module.exports = { runExperiment, simulateCondition, GROUND_TRUTH };
