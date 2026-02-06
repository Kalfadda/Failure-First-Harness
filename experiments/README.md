# Experiments

This directory contains the experiment infrastructure for validating the Failure-First Harness thesis.

## Quick Start

```bash
# Run experiment with all conditions (A, B, C)
npm run experiment:all

# Score a specific result
npm run score -- tasks/validate-signature.json results/<run-id>.json

# Compare all scored results
npm run compare -- results/*-scored.json
```

## Structure

```
experiments/
├── tasks/           # Task definitions with ground truth
├── results/         # Experiment output
└── scoring/         # Scoring and comparison scripts
```

## Conditions

| Condition | Description | Workflow |
|-----------|-------------|----------|
| A | Single agent | plan → implement → self-verify |
| B | Two-agent | builder → verifier (same model) |
| C | Three-agent harness | adversary → builder → verifier |

## Metrics

- **Coverage**: % of ground truth failures identified
- **False completion rate**: % of ground truth failures missed
- **Verification accuracy**: % of verified claims that are actually correct

## Tasks

### validate-signature (task-001)

Implement HMAC-SHA256 webhook signature validation.

Ground truth failures: 10
- GT001-GT010 cover input validation, timing attacks, encoding issues

## Running Real Experiments

The current implementation uses simulated agent responses. To run with real LLM agents:

1. Replace `SIMULATED_AGENTS` in `run-experiment.js` with actual API calls
2. Each condition should follow its specific workflow:
   - **A**: Single prompt asking agent to identify, implement, and verify
   - **B**: Two separate prompts - builder then verifier
   - **C**: Three prompts following the Failure-First protocol
