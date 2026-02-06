# Failure-First Harness

**Structural role separation for reliable AI-assisted development.**

> Single-agent coding assistants miss 70% of bugs while claiming "done."
> The Failure-First Harness cuts that to 23%.

---

## The Evidence

We ran 3 stress tests across 36 ground-truth failures. The results:

| Condition | Coverage | False Completion | Improvement |
|-----------|----------|------------------|-------------|
| A: Single Agent | 30.1% | 69.9% | baseline |
| B: Builder + Verifier | 49.9% | 50.1% | +19.8pp |
| **C: Failure-First Harness** | **77.2%** | **22.8%** | **+47.1pp** |

**The hypothesis (C > B > A) holds across all three tests.**

### Test Results by Domain

| Domain | Single Agent | Harness | Gap |
|--------|--------------|---------|-----|
| Password Reset Security | 48.3% | 88.3% | +40.0pp |
| Shopping Cart State Machine | 32.5% | 84.6% | +52.1pp |
| Adversarial Deceptive Code | 9.6% | 58.8% | +49.2pp |

The hardest category (code that *looks* secure but isn't) shows the largest gap: single agents catch only 9.6% of vulnerabilities while the harness catches 58.8%.

---

## Reproduce It Yourself

```bash
git clone https://github.com/Kalfadda/Failure-First-Harness.git
cd Failure-First-Harness
node stress-tests/run-all-experiments.js
```

Output includes:
- Coverage percentages for each condition
- Category-by-category breakdowns
- False completion rates
- Hypothesis verification

All tests are deterministic and reproducible.

---

## The Thesis

**Reliability in AI-assisted development is a governance problem, not a prompting problem.**

Single agents fail predictably:
- They claim completion before critical failures are addressed
- They verify their own work and find it satisfactory
- They see security checks and assume the code is secure
- They miss race conditions, state bugs, and injection attacks

Better prompts don't fix structural conflicts of interest.

The Failure-First Harness applies separation of powers:

| Role | Job | Constraint |
|------|-----|------------|
| **Adversary** | Enumerate what can go wrong | Cannot suggest implementations |
| **Builder** | Implement guardrails | Cannot mark work as verified |
| **Verifier** | Validate with evidence | Must provide proof, not assertions |
| **Resolver** | Accept risk (human only) | Must be a human, logged |

This creates mechanical guarantees:
- No completion without independent verification
- No scope drift (spec is frozen before building)
- No rubber-stamp verification (evidence required)
- No hidden risk acceptance (human sign-off required)

---

## Why It Works

### 1. Adversarial Enumeration Forces Coverage

Single agents enumerate "obvious" failures, then stop. The adversary role is prompted to think like an attacker:

> "How would you break this? What edge cases exist? What happens under race conditions?"

Result: Race condition detection goes from 3% (single agent) to 67% (harness).

### 2. Separation Prevents Self-Certification

When the same agent builds and verifies, verification rate drops to ~45%. When separated, it rises to ~90%.

The builder cannot mark failures as VERIFIED. Only the verifier can. This is mechanically enforced.

### 3. Deceptive Code Gets Caught

"Secure-looking" code fools single agents (9.6% detection). The harness forces explicit enumeration of attack patterns:

- MIME type spoofing (checks Content-Type, not magic bytes)
- Double extension bypass (.exe.png)
- Encoded path traversal (%2e%2e%2f)
- TOCTOU race conditions
- Integer overflow in size checks

Single agents see the security checks and assume secure. The adversary role asks "how can these checks be bypassed?"

---

## Quick Start

### Using the CLI

```bash
# Initialize a project
node cli/ffh.js init

# Start adversary phase (enumerate failures)
node cli/ffh.js freeze   # Lock the spec before building

# Builder phase
node cli/ffh.js claim F001   # Claim a failure is addressed

# Verifier phase
node cli/ffh.js verify F001 --evidence "test output..."

# Check status
node cli/ffh.js status
node cli/ffh.js report
```

### Using the Claude Code Skill

```
/FailFirst              # Start or resume
/FailFirst adversary    # Enumerate failures
/FailFirst builder      # Implement guardrails
/FailFirst verifier     # Verify with evidence
/FailFirst status       # Show state
```

---

## What's Validated vs. What's Claimed

### Validated by stress tests

| Claim | Evidence |
|-------|----------|
| Harness outperforms single-agent | 77.2% vs 30.1% coverage across 3 tests |
| Harness outperforms two-agent | 77.2% vs 49.9% coverage |
| Separation reduces false completion | 22.8% vs 69.9% |
| Adversarial enumeration catches deceptive code | 58.8% vs 9.6% |
| Race conditions require explicit prompting | 67% vs 3% detection |

### Claims (not yet independently validated)

| Claim | Status |
|-------|--------|
| Works at production scale | Untested |
| Overhead is acceptable for most projects | Depends on domain |
| Different verifier models improve results | Condition D not yet tested |
| Human-in-the-loop improves CRITICAL verification | Not yet measured |

---

## Stress Test Details

### Test 1: Password Reset Security (12 failures)

Ground truth includes:
- Token not invalidated after use
- Token never expires
- User enumeration via error messages
- Race condition on simultaneous resets
- Token entropy too low
- No rate limiting
- Sessions not invalidated on reset

**Results:** A=48.3%, B=69.6%, C=88.3%

### Test 2: Shopping Cart State Machine (12 failures)

Ground truth includes:
- Negative quantity allows free items
- Price cached at add time (doesn't update)
- Discount codes reapplied
- Race condition on checkout
- Inventory oversold
- Float precision errors
- Cart manipulation during checkout

**Results:** A=32.5%, B=57.9%, C=84.6%

Category breakdown:
| Category | Single Agent | Harness |
|----------|--------------|---------|
| Validation | 88% | 97% |
| State | 25% | 92% |
| Race | 3% | 67% |
| Transaction | 5% | 85% |

### Test 3: Adversarial Red Team (12 failures)

Code that LOOKS secure but contains subtle vulnerabilities:
- MIME type spoofing (trusts Content-Type header)
- Double extension bypass (.exe.png)
- Encoded path traversal (%2e%2e%2f)
- TOCTOU race condition
- Null byte injection
- Integer overflow in size validation
- Auth header case sensitivity
- Symlink following
- Command injection in "security" feature
- Predictable temp file names

**Results:** A=9.6%, B=22.1%, C=58.8%

Deception level breakdown:
| Deception Level | Single Agent | Harness |
|-----------------|--------------|---------|
| Low | 70% | 90% |
| Medium | 20% | 75% |
| High | 4% | 59% |
| Very High | 1% | 49% |

---

## Architecture

### FailureSpec v1.0

Failures are specified in a structured format:

```json
{
  "id": "F001",
  "title": "Signature verification bypass",
  "severity": "critical",
  "oracle": {
    "condition": "Requests without valid HMAC-SHA256 return 401",
    "falsifiable": true
  },
  "repro": {
    "steps": ["Remove signature header", "POST to endpoint", "Observe response"]
  },
  "evidence": {
    "type": "integration_test",
    "criteria": "Test asserts 401 response and no DB writes"
  },
  "status": {
    "state": "verified",
    "verification": {
      "evidence": "curl returned 401; test_unsigned passed",
      "evidence_hash": "sha256:a1b2c3..."
    }
  }
}
```

### State Machine

```
UNADDRESSED --> IN_PROGRESS --> CLAIMED --> VERIFIED
                                   |            |
                                   v            v
                              (rejected)   ACCEPTED_RISK
                                          (human only)
```

### Role Constraints

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| Adversary | Enumerate failures, set severity | Suggest implementations |
| Builder | Write code, claim addressed | Mark as verified |
| Verifier | Validate claims, reject/verify | Skip evidence requirement |
| Resolver | Accept risk with justification | Be an automated agent |

---

## Project Structure

```
.
├── README.md                 # This file
├── CLAUDE.md                 # Claude Code instructions
├── cli/
│   └── ffh.js                # Reference CLI implementation
├── failurespec/
│   ├── schema.json           # JSON Schema for FailureSpec
│   ├── validate.js           # Spec validator
│   └── freeze.js             # Spec freezing tool
├── verifier/
│   └── run.js                # Evidence-based verifier
├── experiments/
│   ├── run-experiment.js     # Condition comparison runner
│   └── scoring/
│       └── score.js          # Coverage scoring
├── stress-tests/
│   ├── run-all-experiments.js  # Combined test runner
│   ├── password-reset/       # Test 1
│   ├── shopping-cart/        # Test 2
│   └── adversarial-redteam/  # Test 3
├── case-studies/
│   └── webhook/              # Webhook receiver example
└── .claude/
    ├── skills/
    │   └── fail-first.md     # /FailFirst skill definition
    └── templates/            # Domain-specific templates
```

---

## When to Use This

**Good fit:**
- Security-sensitive features
- External integrations (webhooks, APIs)
- State machines with edge cases
- Features where bugs have significant cost
- Unfamiliar domains

**Skip when:**
- Prototype/throwaway code
- Single-session obvious implementation
- Overhead exceeds reliability value

---

## Known Limitations

| Limitation | Mitigation |
|------------|------------|
| Adversary can miss failures | Multiple passes, domain templates, human review |
| Same model may share blind spots | Different verifier model (not yet tested) |
| "Frozen" is social contract | Enforce via CI gates, signing, content-addressing |
| Overhead may not be worth it for simple tasks | Use judgment, skip for trivial work |

---

## Roadmap

- [x] FailureSpec schema and validation
- [x] Three-role architecture
- [x] CLI reference implementation
- [x] Stress test suite (3 domains, 36 failures)
- [x] Combined results and analysis
- [ ] Different verifier model comparison (Condition D)
- [ ] Human-in-the-loop measurements
- [ ] Production-scale case study
- [ ] Template library expansion

---

## Contributing

We welcome:
- Additional stress test scenarios
- Reference implementations in other languages
- Experimental results (validating or challenging the thesis)
- Domain-specific failure templates

---

## License

MIT

---

## Citation

If you use this work, please cite:

```
Failure-First Harness: Structural Role Separation for Reliable AI-Assisted Development
https://github.com/Kalfadda/Failure-First-Harness
```
