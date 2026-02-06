# Failure-First Harness

Separation of powers for agentic software development.

## The problem

Agentic coding workflows fail in predictable ways:

- Agents claim completion before critical failures are addressed
- Agents verify their own work and find it satisfactory
- Requirements drift during implementation with no stable baseline
- Failures discovered in production that were knowable in advance

These aren't capability failures. They're structural conflicts of interest. The agent that identifies problems is biased toward solvable problems. The agent that implements solutions is biased toward "looks complete." The agent that verifies is biased toward confirming its own work.

Better prompts don't fix incentive misalignment.

## The thesis

**Reliability in AI-assisted development is a governance problem, not a prompting problem.**

The Failure-First Harness applies separation of powers to agentic workflows:

1. **A role that defines what can go wrong** — frozen before implementation begins
2. **A role that implements fixes** — cannot certify its own work
3. **A role that verifies via adversarial evidence** — independent, with execution tools
4. **A role that resolves disputes and accepts risk** — human authority, auditable

This is falsifiable. Projects using the harness should exhibit:

- **Lower false completion rates** — fewer "complete" claims where critical failures remain unaddressed
- **Higher verification accuracy** — fewer VERIFIED statuses that fail independent testing
- **Greater scope stability** — fewer mid-implementation changes to requirements

If controlled experiments show no improvement on these metrics, or if the overhead exceeds the reliability gain, the thesis is wrong.

## The core mechanism

The harness enforces completion criteria through a state machine:

```
UNADDRESSED ──▶ IN_PROGRESS ──▶ CLAIMED ──▶ VERIFIED
                                   │            │
                                   ▼            │
                              UNADDRESSED       │
                            (verifier rejects)  │
                                                │
                    ACCEPTED_RISK ◀─────────────┘
                  (human authority only)
```

**Why this matters:** The builder cannot set VERIFIED. Only the verifier can. Completion is mechanically impossible without independent verification of every critical failure.

## Guarantees and non-guarantees

The harness provides **process guarantees**, not **outcome guarantees**. Conflating these loses credibility.

### Process guarantees

| Guarantee | Mechanism | Strength |
|-----------|-----------|----------|
| No completion without verification | State machine; builder cannot set VERIFIED | Strong if enforced |
| Scope explicit before implementation | Frozen spec created before building | Strong if enforced |
| Claims require evidence | Schema mandates evidence; empty evidence fails validation | Medium |
| Decisions auditable | All state transitions logged with timestamps | Strong |

### Outcome non-guarantees

| Non-guarantee | Why |
|---------------|-----|
| Complete failure coverage | Adversary enumeration depends on prompt, model, and domain knowledge |
| Correct verification | Verifier can be wrong, weak, or share blind spots with builder |
| Actual immutability | "Frozen" is social contract unless technically enforced (signing, CI) |
| Optimal implementation | Builder can write bad code that technically "handles" a failure |
| True independence | Same model as builder means shared blind spots |

**The honest statement:** The harness makes certain failure modes structurally harder, not impossible. It shifts the burden from "hope the agent is reliable" to "verify the agent's claims with evidence."

## Architecture

### Role 1: Adversary

Enumerates failure modes. Knows the feature specification. Does not know the implementation approach.

```
Input:  Feature specification
Output: FailureSpec (frozen after this phase)
Goal:   Enumerate every way the feature can fail
```

The adversary's output becomes the contract. Once frozen, modification requires explicit scope-change workflow.

**Failure mode of this role:** Shallow enumeration. The adversary lists obvious failures, misses systemic ones.

**Mitigation:** Multiple passes with different prompts. Domain-specific templates. Human review before freeze. Meta-adversary that critiques the failure list.

### Role 2: Builder

Implements guardrails and features. Knows the failure spec. Cannot modify it.

```
Input:  FailureSpec + codebase
Output: Implementation with claims
Goal:   Address failures by priority
```

Constraints:
- Cannot modify the failure spec
- Cannot set VERIFIED — only CLAIMED
- Must commit after each failure addressed
- Logs discoveries to separate file

**Failure mode of this role:** Implements guardrails that "pass" but are bypassable.

**Mitigation:** Verifier with execution tools. Fuzzing. Human review for CRITICAL.

### Role 3: Verifier

Validates implementation against failure spec. Knows failures and code. Does not know builder's reasoning.

```
Input:  FailureSpec + implementation
Output: Verification with evidence
Goal:   Confirm or reject each claim
```

Requirements:
- Must attempt to trigger each failure using repro steps
- Must provide concrete evidence, not assertions
- Must have execution tools (tests, REPL, staging)

**Failure mode of this role:** Rubber-stamp verification. Same model, same blind spots.

**Mitigation:** Independence requirements (see below).

### Role 4: Resolver (optional)

Handles disputes and risk acceptance. Human or designated authority.

```
Input:  Contested claims, risk acceptance requests
Output: Binding decisions with justification
Goal:   Resolve ambiguity, accept risk explicitly
```

All resolver decisions are logged with identity and timestamp.

## Verifier independence

Information asymmetry is necessary but not sufficient. If the verifier shares the builder's blind spots, verification is theatre.

**Minimum viable independence (at least one must hold):**

| Mechanism | What it provides |
|-----------|------------------|
| Different model or vendor | Different training, different blind spots |
| Execution tools | Can run tests, hit staging, fuzz — not just read code |
| Strict evidence rubric | Must produce artifacts, not assertions |
| Human-in-the-loop for CRITICAL | Ultimate independence for highest severity |

**Concrete requirement:** Verifier must execute repro steps and produce observable evidence. "I reviewed the code and it looks correct" is not verification.

## FailureSpec v1.0

The failure specification is an interoperable artifact. Teams can adopt the spec without the full harness.

### Schema

```yaml
$schema: "https://failurespec.org/v1/schema.json"
version: "1.0"

metadata:
  feature: string
  created_by: string
  frozen_at: timestamp | null
  frozen_commit: string | null      # Git SHA or content hash

failures:
  - id: string                      # REQUIRED (e.g., "F001")
    title: string                   # REQUIRED (< 80 chars)
    severity: critical | high | medium | low  # REQUIRED

    oracle:                         # REQUIRED: What must be true when fixed
      condition: string             # Testable assertion
      falsifiable: boolean          # Can this be verified programmatically?

    repro:                          # REQUIRED: How to trigger
      preconditions: string[]
      steps: string[]               # At least one step
      expected_if_vulnerable: string

    evidence:                       # REQUIRED: What proof is acceptable
      type: unit_test | integration_test | e2e_test | fuzz | load_test | manual
      criteria: string              # What evidence must demonstrate

    # OPTIONAL
    description: string
    impact: string
    likelihood: high | medium | low
    blast_radius: system | service | component
    category: security | validation | resource | integration | logic
    detection: string               # How to notice in production

    ownership: owned | inherited | integration
    inherited_from:
      source: string
      version: string
      original_id: string

    # MUTABLE: Execution state
    status:
      state: unaddressed | in_progress | claimed | verified | rejected | accepted_risk

      guardrail:
        design: string
        location: string            # file:lines
        implemented_by: string
        implemented_at: timestamp

      verification:
        method: string
        evidence: string            # Concrete evidence or URI
        evidence_hash: string       # SHA256 of artifact
        verified_by: string
        verified_at: timestamp

      risk_acceptance:
        reason: string
        accepted_by: string         # Must be human
        accepted_at: timestamp
        review_by: timestamp        # When to re-evaluate

discoveries:                        # Failures found during execution
  - id: string                      # D001, D002, etc.
    description: string
    discovered_by: string
    discovered_at: timestamp
    disposition: pending | add_to_next | accepted_risk | duplicate
```

### Validation rules

```
REQUIRED fields must be non-empty.

oracle.condition must be a testable assertion.
  VALID: "returns 401 for unsigned requests"
  INVALID: "should be secure"

repro.steps must have at least one step.

evidence.type must be from the enum.
evidence.criteria must describe observable behavior.

If ownership is "inherited", inherited_from is required.
If status.state is "verified", verification must be populated.
If status.state is "accepted_risk", risk_acceptance must be populated.
  risk_acceptance.accepted_by must not be an automated agent.
```

### Example

```json
{
  "id": "F001",
  "title": "Signature verification bypass",
  "severity": "critical",

  "oracle": {
    "condition": "Requests without valid HMAC-SHA256 signature return 401 and do not modify state",
    "falsifiable": true
  },

  "repro": {
    "preconditions": ["Webhook endpoint is deployed", "Valid payload structure known"],
    "steps": [
      "Capture a valid webhook payload",
      "Remove or corrupt the X-Signature header",
      "POST to /webhooks/stripe",
      "Observe response and database state"
    ],
    "expected_if_vulnerable": "Request succeeds (2xx) or state is modified"
  },

  "evidence": {
    "type": "integration_test",
    "criteria": "Test sends unsigned request, asserts 401 response, asserts no database writes"
  },

  "impact": "Arbitrary order state manipulation; financial loss",
  "likelihood": "high",
  "blast_radius": "system",
  "category": "security",

  "status": {
    "state": "verified",
    "guardrail": {
      "design": "Signature validation middleware as first handler",
      "location": "src/webhooks/verify.ts:15-42",
      "implemented_by": "builder-session-002",
      "implemented_at": "2024-01-15T12:00:00Z"
    },
    "verification": {
      "method": "Executed repro steps; ran integration test suite",
      "evidence": "curl -X POST /webhook -d '{}' returned 401; test_unsigned_webhook passed",
      "evidence_hash": "sha256:a1b2c3...",
      "verified_by": "verifier-session-003",
      "verified_at": "2024-01-15T14:20:00Z"
    }
  }
}
```

## Frozen means frozen

"Frozen" is a social contract unless you enforce it technically.

### Enforcement options

| Mechanism | Enforcement level |
|-----------|-------------------|
| Commit hash reference | Medium — modification creates different hash, detectable |
| Content-addressed storage | Strong — content determines address, modification is new file |
| Cryptographic signing | Strong — tampering breaks signature |
| CI gate | Strong — PR blocked if frozen file modified |

### Handling discoveries

Failures discovered during building or verification are real. The harness routes them through controlled process:

```
discoveries.json captures mid-flight findings
  ↓
Human reviews and decides:
  → add_to_next: Include in next iteration's spec
  → accepted_risk: Document and proceed
  → duplicate: Already covered by existing failure
  → restart: Expand scope, create new frozen spec
```

The default path is never to edit the frozen spec mid-run.

## Prioritization

"By priority" is not an algorithm. Here is one:

```
PRIORITY = (severity × 1000) + (likelihood × 100) + (blast_radius × 10) - (verification_ease × 5)

severity:          critical=4, high=3, medium=2, low=1
likelihood:        high=3, medium=2, low=1
blast_radius:      system=3, service=2, component=1
verification_ease: trivial=3, moderate=2, hard=1
```

**Key insight:** Hard-to-verify failures go earlier, not later. If you defer them, you run out of time and start accepting risk casually.

## How this harness fails

The harness has failure modes. Acknowledging them is honest engineering.

| Failure mode | Mitigation |
|--------------|------------|
| Shallow adversary enumeration | Multiple passes; domain templates; human review before freeze |
| Bypassable guardrails | Verifier with execution tools; fuzzing; human review for CRITICAL |
| Rubber-stamp verification | Strict evidence requirements; evidence must be artifacts, not assertions |
| Spec bloat | Severity-based cutoffs; deduplication; periodic pruning |
| Architectural fragmentation | Design coherence pass after guardrail phase |
| Frozen spec not enforced | CI gates; signing; content-addressed storage |
| Verifier shares builder's blind spots | Different model; execution tools; human-in-the-loop |

## Positioning

This is not novel. It combines existing engineering practices:

| Practice | Source | Role in harness |
|----------|--------|-----------------|
| Threat modeling | Security engineering | Adversary phase |
| Change control | Project management | Frozen spec, scope-change workflow |
| Independent review | Audit, compliance | Verifier independence |
| Evidence-based verification | Testing, formal methods | Required evidence types |
| Separation of duties | Security, finance | Role restrictions |

**One sentence:** The Failure-First Harness is an SDLC control system for AI agents, applying governance patterns that work for human organizations to agentic workflows.

## Experimental validation

To validate the thesis, we propose:

### Experiment 1: False completion rate

**Setup:**
- 30 tasks of moderate complexity
- Hidden ground-truth failure list per task (10-15 failures)
- Four conditions:
  - A: Single agent (plan → implement → self-verify)
  - B: Two-agent (builder + verifier, same model)
  - C: Three-agent harness (same model)
  - D: Three-agent harness with independence (different verifier model)

**Procedure:**
- Run each task in each condition
- Agent claims completion
- Red team attacks using ground truth
- Score: % of ground truth failures actually handled

**Hypothesis:** D > C > B > A

### Experiment 2: Verification accuracy

**Setup:** Take VERIFIED failures from Experiment 1

**Procedure:** Independent red team attempts to trigger each failure

**Metric:** % of VERIFIED that holds up

**Hypothesis:** D > C, both >> B

### Experiment 3: Overhead ratio

**Metric:** tokens(condition X) / tokens(baseline A)

**Decision threshold:** Harness is worth it if reliability gain > overhead cost for the domain. Security-critical: high tolerance for overhead. Prototypes: low tolerance.

## Skill: /FailFirst

The harness is available as a Claude Code skill for interactive use.

```
/FailFirst              # Start new harness or resume
/FailFirst adversary    # Enumerate failures (cannot implement)
/FailFirst builder      # Implement guardrails (cannot verify)
/FailFirst verifier     # Verify with evidence (adversarial)
/FailFirst status       # Show current state
/FailFirst report       # Generate status report
```

The skill enforces role constraints automatically:
- Adversary phase: Cannot suggest implementations
- Builder phase: Cannot set VERIFIED (only CLAIMED)
- Verifier phase: Must provide evidence, not assertions

See `.claude/skills/fail-first.md` for full skill definition.

### Templates

Starter templates accelerate adversary enumeration:

```
.claude/templates/
├── webhook-receiver.yaml   # Payment callbacks, GitHub webhooks
├── authentication.yaml     # Login, sessions, MFA, password reset
├── file-upload.yaml        # Images, documents, attachments
└── api-endpoint.yaml       # REST/GraphQL CRUD operations
```

## Reference implementation

### CLI

```bash
ffh init                    # Create .failure-first directory
ffh freeze                  # Freeze spec, record commit hash
ffh status                  # Show state of all failures
ffh claim F001              # Mark failure as claimed by builder
ffh verify F001 --evidence "..."  # Verify with evidence
ffh reject F001 --reason "..."    # Reject claim
ffh accept-risk F001 --reason "..." --by "human@example.com"
ffh discover "description"  # Log discovered failure
ffh report                  # Generate status report
```

### CI integration

```yaml
# .github/workflows/failure-first.yml
- name: Check frozen spec unchanged
  run: ffh check-frozen

- name: Verify critical failures
  run: ffh gate --severity critical --require verified

- name: Generate report
  run: ffh report --format markdown > failure-report.md
```

## Starter templates

Pre-built templates prompt the adversary to consider failure classes:

```
# templates/webhook-receiver.yaml
failure_classes:
  - authentication:
      prompt: "How can authentication be bypassed or forged?"
      examples: ["signature bypass", "replay attacks", "timing attacks"]
  - input_validation:
      prompt: "What malformed inputs could cause failures?"
      examples: ["oversized payloads", "malformed JSON", "unexpected types"]
  - ordering:
      prompt: "What happens if events arrive out of order or duplicated?"
      examples: ["duplicate delivery", "out-of-order events", "missing events"]
  - resource:
      prompt: "How can resources be exhausted?"
      examples: ["memory exhaustion", "connection exhaustion", "disk full"]
```

Templates accelerate adversary enumeration without becoming stale pre-built lists.

## When to use

**Good candidates:**
- Security-sensitive features
- External integrations
- Features where failure has significant cost
- Multi-session implementations
- Unfamiliar domains

**Skip when:**
- Single-session, obvious implementation
- Prototype where correctness doesn't matter yet
- Overhead exceeds reliability value

## Roadmap

### v1.0 (current)
- FailureSpec schema with validation
- Three-role architecture
- CLI reference implementation
- CI integration patterns

### v1.1
- Composition semantics (inherited + integration failures)
- Evidence artifact storage
- Template library for common domains

### v2.0
- Formal verification integration
- Automated red-team tooling
- Cross-project failure inheritance

## Related work

- **Anthropic's agent harness patterns** — addresses context exhaustion; this harness adds role separation and verification independence
- **STRIDE/PASTA threat modeling** — systematic failure enumeration; this harness operationalizes it for agentic workflows
- **Change control (ITIL, etc.)** — frozen requirements and scope management; this harness applies it to AI-generated code

## Contributing

- Reference implementations in other languages/tools
- Failure templates for common domains
- Experimental results validating or challenging the thesis
- Formal analysis of guarantees and their limits

## License

MIT
