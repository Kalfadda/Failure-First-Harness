#!/usr/bin/env node
/**
 * FailureSpec Validator
 *
 * Validates FailureSpec files against the schema and semantic rules.
 *
 * Usage:
 *   node validate.js <failurespec.json>
 *   node validate.js --lint <failurespec.json>
 */

const fs = require('fs');
const path = require('path');

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const VALID_STATES = ['unaddressed', 'in_progress', 'claimed', 'verified', 'rejected', 'accepted_risk'];
const VALID_EVIDENCE_TYPES = [
  'unit_test', 'integration_test', 'e2e_test', 'fuzz', 'load_test', 'manual',
  'code_review', 'security_test', 'timing_analysis', 'log_analysis', 'log_search',
  'network_capture', 'header_inspection', 'traffic_analysis', 'token_inspection',
  'manual_test', 'log_inspection'
];

function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return { error: e.message };
  }
}

class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  error(path, message) {
    this.errors.push({ path, message });
  }

  warn(path, message) {
    this.warnings.push({ path, message });
  }

  get valid() {
    return this.errors.length === 0;
  }
}

function validateSchema(spec, result) {
  // Required top-level fields
  if (!spec.version) {
    result.error('version', 'Missing required field: version');
  } else if (spec.version !== '1.0') {
    result.error('version', `Invalid version: ${spec.version} (expected "1.0")`);
  }

  if (!spec.metadata) {
    result.error('metadata', 'Missing required field: metadata');
  } else {
    if (!spec.metadata.feature) {
      result.error('metadata.feature', 'Missing required field: feature');
    }
    if (!spec.metadata.created_by) {
      result.error('metadata.created_by', 'Missing required field: created_by');
    }
  }

  if (!spec.failures) {
    result.error('failures', 'Missing required field: failures');
  } else if (!Array.isArray(spec.failures)) {
    result.error('failures', 'failures must be an array');
  }
}

function validateFailure(failure, index, result) {
  const prefix = `failures[${index}]`;

  // Required fields
  if (!failure.id) {
    result.error(`${prefix}.id`, 'Missing required field: id');
  } else if (!/^F\d{3}$/.test(failure.id)) {
    result.error(`${prefix}.id`, `Invalid id format: ${failure.id} (expected F001, F002, etc.)`);
  }

  if (!failure.title) {
    result.error(`${prefix}.title`, 'Missing required field: title');
  } else if (failure.title.length > 80) {
    result.error(`${prefix}.title`, `Title too long: ${failure.title.length} chars (max 80)`);
  }

  if (!failure.severity) {
    result.error(`${prefix}.severity`, 'Missing required field: severity');
  } else if (!SEVERITY_ORDER.includes(failure.severity)) {
    result.error(`${prefix}.severity`, `Invalid severity: ${failure.severity}`);
  }

  // Oracle validation
  if (!failure.oracle) {
    result.error(`${prefix}.oracle`, 'Missing required field: oracle');
  } else {
    if (!failure.oracle.condition) {
      result.error(`${prefix}.oracle.condition`, 'Missing required field: condition');
    } else {
      // Check for vague conditions
      const vaguePhrases = ['should be secure', 'must be safe', 'needs to work'];
      for (const phrase of vaguePhrases) {
        if (failure.oracle.condition.toLowerCase().includes(phrase)) {
          result.error(`${prefix}.oracle.condition`, `Condition is too vague: "${failure.oracle.condition}". Must be testable.`);
        }
      }
    }
    if (failure.oracle.falsifiable === undefined) {
      result.error(`${prefix}.oracle.falsifiable`, 'Missing required field: falsifiable');
    }
  }

  // Repro validation
  if (!failure.repro) {
    result.error(`${prefix}.repro`, 'Missing required field: repro');
  } else {
    if (!failure.repro.steps || !Array.isArray(failure.repro.steps) || failure.repro.steps.length === 0) {
      result.error(`${prefix}.repro.steps`, 'repro.steps must be a non-empty array');
    }
    if (!failure.repro.expected_if_vulnerable) {
      result.error(`${prefix}.repro.expected_if_vulnerable`, 'Missing required field: expected_if_vulnerable');
    }
  }

  // Evidence validation
  if (!failure.evidence) {
    result.error(`${prefix}.evidence`, 'Missing required field: evidence');
  } else {
    if (!failure.evidence.type) {
      result.error(`${prefix}.evidence.type`, 'Missing required field: type');
    } else if (!VALID_EVIDENCE_TYPES.includes(failure.evidence.type)) {
      result.error(`${prefix}.evidence.type`, `Invalid evidence type: ${failure.evidence.type}`);
    }
    if (!failure.evidence.criteria) {
      result.error(`${prefix}.evidence.criteria`, 'Missing required field: criteria');
    }
  }

  // Status validation
  if (failure.status) {
    if (!failure.status.state) {
      result.error(`${prefix}.status.state`, 'Missing required field: state');
    } else if (!VALID_STATES.includes(failure.status.state)) {
      result.error(`${prefix}.status.state`, `Invalid state: ${failure.status.state}`);
    }

    // Verified requires verification evidence
    if (failure.status.state === 'verified') {
      if (!failure.status.verification) {
        result.error(`${prefix}.status.verification`, 'State is "verified" but verification is missing');
      } else if (!failure.status.verification.evidence) {
        result.error(`${prefix}.status.verification.evidence`, 'Verification must include evidence');
      }
    }

    // Accepted risk requires human authority
    if (failure.status.state === 'accepted_risk') {
      if (!failure.status.risk_acceptance) {
        result.error(`${prefix}.status.risk_acceptance`, 'State is "accepted_risk" but risk_acceptance is missing');
      } else if (!failure.status.risk_acceptance.accepted_by) {
        result.error(`${prefix}.status.risk_acceptance.accepted_by`, 'risk_acceptance must include accepted_by');
      }
    }
  }

  // Ownership validation
  if (failure.ownership === 'inherited' && !failure.inherited_from) {
    result.error(`${prefix}.inherited_from`, 'Ownership is "inherited" but inherited_from is missing');
  }
}

function lint(spec, result) {
  if (!spec.failures) return;

  const ids = new Set();
  const titles = new Set();

  for (let i = 0; i < spec.failures.length; i++) {
    const f = spec.failures[i];
    const prefix = `failures[${i}]`;

    // Check for duplicate IDs
    if (f.id) {
      if (ids.has(f.id)) {
        result.error(`${prefix}.id`, `Duplicate failure ID: ${f.id}`);
      }
      ids.add(f.id);
    }

    // Check for duplicate titles
    if (f.title) {
      if (titles.has(f.title.toLowerCase())) {
        result.warn(`${prefix}.title`, `Possible duplicate title: ${f.title}`);
      }
      titles.add(f.title.toLowerCase());
    }

    // Check for missing optional fields on critical/high severity
    if (f.severity === 'critical' || f.severity === 'high') {
      if (!f.impact) {
        result.warn(`${prefix}.impact`, `${f.severity} severity failure should have impact defined`);
      }
      if (!f.detection) {
        result.warn(`${prefix}.detection`, `${f.severity} severity failure should have detection defined`);
      }
    }

    // Check for assertion-only evidence criteria
    if (f.evidence && f.evidence.criteria) {
      const assertionPhrases = ['looks correct', 'seems fine', 'appears to work', 'should work'];
      for (const phrase of assertionPhrases) {
        if (f.evidence.criteria.toLowerCase().includes(phrase)) {
          result.warn(`${prefix}.evidence.criteria`, `Evidence criteria appears to be an assertion, not observable behavior`);
        }
      }
    }
  }

  // Check for frozen spec modifications
  if (spec.metadata && spec.metadata.frozen_at) {
    result.warn('metadata', `Spec is frozen as of ${spec.metadata.frozen_at}. Modifications should go to discoveries.`);
  }
}

function validate(filepath, options = {}) {
  const spec = loadJSON(filepath);

  if (spec.error) {
    console.error(`Error reading file: ${spec.error}`);
    process.exit(1);
  }

  const result = new ValidationResult();

  // Schema validation
  validateSchema(spec, result);

  // Failure validation
  if (Array.isArray(spec.failures)) {
    for (let i = 0; i < spec.failures.length; i++) {
      validateFailure(spec.failures[i], i, result);
    }
  }

  // Lint checks
  if (options.lint) {
    lint(spec, result);
  }

  return result;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('FailureSpec Validator');
    console.log('');
    console.log('Usage:');
    console.log('  node validate.js <failurespec.json>');
    console.log('  node validate.js --lint <failurespec.json>');
    console.log('');
    console.log('Options:');
    console.log('  --lint    Include style warnings');
    process.exit(1);
  }

  let lintMode = false;
  let filepath = null;

  for (const arg of args) {
    if (arg === '--lint') {
      lintMode = true;
    } else {
      filepath = arg;
    }
  }

  if (!filepath) {
    console.error('Error: No file specified');
    process.exit(1);
  }

  const result = validate(path.resolve(filepath), { lint: lintMode });

  // Output results
  console.log(`Validating: ${filepath}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length}):`);
    for (const e of result.errors) {
      console.log(`  [ERROR] ${e.path}: ${e.message}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.log(`  [WARN]  ${w.path}: ${w.message}`);
    }
    console.log('');
  }

  if (result.valid) {
    console.log('Validation: PASSED');
    if (result.warnings.length > 0) {
      console.log(`           (${result.warnings.length} warnings)`);
    }
    process.exit(0);
  } else {
    console.log('Validation: FAILED');
    process.exit(1);
  }
}

main();
