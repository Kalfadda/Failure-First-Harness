# /FailFirst

Separation of powers for reliable AI-assisted development.

## Description

The Failure-First Harness applies governance patterns to agentic coding. It separates enumeration, implementation, and verification into distinct phases with restricted permissions and required evidence.

**Invoke with:** `/FailFirst` or `/FailFirst <phase>` or `/FailFirst status`

## Usage

```
/FailFirst              # Start new harness or resume current phase
/FailFirst adversary    # Run adversary phase (enumerate failures)
/FailFirst builder      # Run builder phase (implement guardrails)
/FailFirst verifier     # Run verifier phase (verify with evidence)
/FailFirst status       # Show current state of all failures
/FailFirst discover     # Log a newly discovered failure
/FailFirst freeze       # Freeze the failure spec
/FailFirst report       # Generate status report
```

## Templates

Starter templates accelerate adversary enumeration for common domains:

```
.claude/templates/
├── webhook-receiver.yaml   # Stripe, GitHub, payment webhooks
├── authentication.yaml     # Login, sessions, password reset, MFA
├── file-upload.yaml        # Images, documents, attachments
└── api-endpoint.yaml       # REST/GraphQL CRUD operations
```

When running adversary phase, reference relevant templates to ensure comprehensive coverage.

## Instructions

When this skill is invoked, follow these instructions precisely.

### Phase Detection

First, check for existing harness state:

1. Check if `.failure-first/` directory exists
2. If exists, read `.failure-first/failures.json` to determine current state
3. If no directory exists, this is a new harness — start with adversary phase

### State Machine

Failures progress through states:

```
UNADDRESSED → IN_PROGRESS → CLAIMED → VERIFIED
                              ↓
                         UNADDRESSED (rejected)

Any state → ACCEPTED_RISK (human authority only)
```

**Completion requires:** All `critical` severity failures in `verified` or `accepted_risk` state.

---

## PHASE: ADVERSARY

**Trigger:** `/FailFirst adversary` or new harness without existing spec

**Your role:** You are the ADVERSARY. You enumerate failures. You do not implement solutions.

**Constraints:**
- You know the feature specification
- You do NOT know implementation details
- You do NOT suggest fixes
- You only enumerate what can go wrong

### Adversary Procedure

1. **Ask for feature specification** if not provided:
   ```
   What feature are you implementing? Describe:
   - What it should do
   - Who/what interacts with it
   - What systems it connects to
   - Any security or reliability requirements
   ```

2. **Create harness directory** if it doesn't exist:
   ```
   .failure-first/
   ├── failures.json
   ├── discoveries.json
   └── sessions/
   ```

3. **Enumerate failures systematically.** For each failure, define:
   - `id`: F001, F002, etc.
   - `title`: Short name (< 80 chars)
   - `severity`: critical | high | medium | low
   - `oracle`: What must be true when fixed (testable assertion)
   - `repro`: Steps to trigger the failure
   - `evidence`: What type of proof is required

4. **Use these categories** to ensure comprehensive coverage:
   - **Security:** Authentication bypass, injection, data exposure
   - **Validation:** Malformed inputs, boundary conditions, type confusion
   - **Resource:** Exhaustion, leaks, contention
   - **Integration:** External failures, timeouts, version mismatches
   - **Logic:** Race conditions, ordering, state corruption

5. **Write failures.json** with the enumerated failures (status: unaddressed)

6. **Ask if ready to freeze:**
   ```
   I've enumerated [N] failures:
   - [X] critical
   - [Y] high
   - [Z] medium/low

   Review the list. When ready, say "freeze" to lock the spec.
   After freezing, the spec cannot be modified — only new discoveries logged separately.
   ```

7. **On freeze command:** Set `frozen_at` timestamp and `frozen_commit` if in git repo.

---

## PHASE: BUILDER

**Trigger:** `/FailFirst builder` or resuming with frozen spec

**Your role:** You are the BUILDER. You implement guardrails. You cannot verify your own work.

**Constraints:**
- You know the failure spec (read `.failure-first/failures.json`)
- You CANNOT modify the failure spec
- You CANNOT set status to `verified` — only `claimed`
- You MUST commit after each guardrail
- You log new discoveries to `discoveries.json`, not failures.json

### Builder Procedure

1. **Load and display current state:**
   ```
   Failure Spec Status:
   - F001 [critical] Signature bypass — UNADDRESSED
   - F002 [critical] Replay attack — CLAIMED
   - F003 [high] Input validation — VERIFIED
   ...

   Next priority: F001 (critical, unaddressed)
   ```

2. **Work in priority order:**
   ```
   PRIORITY = severity (critical=4, high=3, medium=2, low=1) × 1000
            + likelihood × 100
            + blast_radius × 10
            - verification_ease × 5
   ```
   Hard-to-verify failures go EARLIER, not later.

3. **For each failure, implement the guardrail:**
   - Read the oracle (what must be true)
   - Design minimal guardrail
   - Implement it
   - Update status to `in_progress` when starting
   - Update status to `claimed` when done, with:
     - `guardrail.design`: What you implemented
     - `guardrail.location`: file:lines
     - `guardrail.implemented_by`: session identifier
     - `guardrail.implemented_at`: timestamp

4. **Commit after each guardrail:**
   ```
   git add <files>
   git commit -m "Guardrail for F001: <title>"
   ```

5. **If you discover a new failure** during implementation:
   - Do NOT add it to failures.json
   - Add it to discoveries.json:
     ```json
     {
       "id": "D001",
       "description": "Race condition between...",
       "discovered_by": "builder",
       "discovered_at": "timestamp",
       "disposition": "pending"
     }
     ```
   - Inform the user:
     ```
     DISCOVERY: Found new failure not in spec.
     Logged to discoveries.json as D001.
     Human decision required: add_to_next | accepted_risk | duplicate
     ```

6. **End session cleanly** when:
   - All critical failures are `claimed` or `verified`
   - Context is running low — commit and note where to resume
   - User requests stop

7. **Handoff to verifier:**
   ```
   Builder phase complete for this session.

   Claimed: F001, F002, F004
   Ready for verification: Run /FailFirst verifier

   Discoveries pending human review: D001
   ```

---

## PHASE: VERIFIER

**Trigger:** `/FailFirst verifier`

**Your role:** You are the VERIFIER. You verify claims with evidence. You are adversarial.

**Constraints:**
- You know the failure spec and the implementation
- You do NOT know the builder's reasoning
- You MUST execute repro steps
- You MUST provide concrete evidence, not assertions
- You CAN set status to `verified` or `rejected`
- "I reviewed the code and it looks correct" is NOT verification

### Verifier Procedure

1. **Load failures with status `claimed`:**
   ```
   Failures pending verification:
   - F001 [critical] Signature bypass — CLAIMED
     Location: src/webhooks/verify.ts:15-42
   - F002 [critical] Replay attack — CLAIMED
     Location: src/webhooks/idempotency.ts:8-30
   ```

2. **For each claimed failure:**

   a. **Read the oracle** — what must be true when fixed

   b. **Read the repro steps** — how to trigger the failure

   c. **Attempt to trigger the failure:**
      - Execute the repro steps against the implementation
      - Use available tools: run tests, curl endpoints, check database state
      - Try variations of the attack vector

   d. **Collect evidence:**
      - Test output
      - HTTP responses
      - Log entries
      - Database state before/after

   e. **Make determination:**

      **If failure is blocked:**
      ```json
      {
        "state": "verified",
        "verification": {
          "method": "Executed repro steps; attempted attack variations",
          "evidence": "curl -X POST /webhook -d '{}' returned 401; DB unchanged",
          "verified_by": "verifier-session-001",
          "verified_at": "2024-01-15T14:20:00Z"
        }
      }
      ```

      **If failure still triggers:**
      ```json
      {
        "state": "unaddressed",
        "verification": {
          "method": "Executed repro steps",
          "evidence": "Unsigned request returned 200; order state modified",
          "rejected_by": "verifier-session-001",
          "rejected_at": "2024-01-15T14:25:00Z",
          "reason": "Signature check only validates presence, not correctness"
        }
      }
      ```

3. **Report results:**
   ```
   Verification complete:

   VERIFIED:
   - F001 Signature bypass — blocked (evidence: 401 on unsigned request)

   REJECTED:
   - F002 Replay attack — still vulnerable (evidence: duplicate ID accepted)

   Rejected failures return to UNADDRESSED for builder to address.
   ```

4. **Check completion criteria:**
   ```
   Completion status:
   - Critical failures: 3/4 verified, 1 rejected
   - NOT COMPLETE — F002 must be verified or risk accepted

   Next steps:
   - Builder: /FailFirst builder (address F002)
   - Or accept risk: /FailFirst accept-risk F002 --reason "..."
   ```

---

## COMMAND: STATUS

**Trigger:** `/FailFirst status`

Display current state of all failures:

```
FAILURE-FIRST HARNESS STATUS
Feature: Webhook receiver for payment notifications
Frozen: 2024-01-15T10:30:00Z (commit a1b2c3d)

FAILURES:
┌──────┬──────────┬─────────────────────────────┬─────────────┐
│ ID   │ Severity │ Title                       │ Status      │
├──────┼──────────┼─────────────────────────────┼─────────────┤
│ F001 │ critical │ Signature bypass            │ VERIFIED    │
│ F002 │ critical │ Replay attack               │ CLAIMED     │
│ F003 │ high     │ Oversized payload           │ UNADDRESSED │
│ F004 │ medium   │ Missing event type          │ IN_PROGRESS │
└──────┴──────────┴─────────────────────────────┴─────────────┘

COMPLETION: NOT READY
- Critical: 1/2 verified
- High: 0/1 verified
- Blocking: F002, F003

DISCOVERIES: 1 pending
- D001: Race condition (pending human decision)
```

---

## COMMAND: DISCOVER

**Trigger:** `/FailFirst discover` or `/FailFirst discover "<description>"`

Log a newly discovered failure that wasn't in the original spec:

1. Add to discoveries.json with `disposition: pending`
2. Inform user of required decision:
   - `add_to_next`: Include in next iteration
   - `accepted_risk`: Document and proceed
   - `duplicate`: Already covered

---

## COMMAND: ACCEPT-RISK

**Trigger:** `/FailFirst accept-risk F001 --reason "..."`

Accept risk for a failure (skips verification):

**Requirements:**
- Must have human confirmation
- Must provide reason
- Logged with identity and timestamp
- Optionally set review_by date

```json
{
  "state": "accepted_risk",
  "risk_acceptance": {
    "reason": "Internal-only endpoint; auth handled at network layer",
    "accepted_by": "human@example.com",
    "accepted_at": "2024-01-15T16:00:00Z",
    "review_by": "2024-04-15T00:00:00Z"
  }
}
```

---

## COMMAND: REPORT

**Trigger:** `/FailFirst report`

Generate markdown report of harness status:

```markdown
# Failure-First Report: Webhook Receiver

**Generated:** 2024-01-15T16:30:00Z
**Feature:** Webhook receiver for payment notifications
**Spec frozen:** 2024-01-15T10:30:00Z

## Summary

| Severity | Total | Verified | Accepted | Remaining |
|----------|-------|----------|----------|-----------|
| Critical | 4     | 3        | 1        | 0         |
| High     | 3     | 2        | 0        | 1         |
| Medium   | 5     | 3        | 0        | 2         |

**Status:** COMPLETE (all critical addressed)

## Failures

### F001: Signature bypass [VERIFIED]
- Severity: critical
- Oracle: Unsigned requests return 401, no state modification
- Guardrail: src/webhooks/verify.ts:15-42
- Evidence: Integration test passes; manual curl returns 401

### F002: Replay attack [ACCEPTED_RISK]
- Severity: critical
- Oracle: Duplicate webhook IDs rejected
- Reason: Stripe guarantees at-least-once, idempotency at DB level
- Accepted by: alice@example.com
- Review by: 2024-04-15

...

## Discoveries

### D001: Race condition [PENDING]
- Description: Concurrent webhooks for same order may conflict
- Disposition: Pending human decision
```

---

## File Structures

### .failure-first/failures.json

```json
{
  "$schema": "https://failurespec.org/v1/schema.json",
  "version": "1.0",
  "metadata": {
    "feature": "Webhook receiver for payment notifications",
    "created_by": "adversary-session-001",
    "frozen_at": "2024-01-15T10:30:00Z",
    "frozen_commit": "a1b2c3d4"
  },
  "failures": [
    {
      "id": "F001",
      "title": "Signature verification bypass",
      "severity": "critical",
      "oracle": {
        "condition": "Requests without valid HMAC-SHA256 return 401, no state change",
        "falsifiable": true
      },
      "repro": {
        "preconditions": ["Endpoint deployed"],
        "steps": ["POST /webhooks/stripe without X-Signature header"],
        "expected_if_vulnerable": "Request succeeds or state modified"
      },
      "evidence": {
        "type": "integration_test",
        "criteria": "Test sends unsigned request, asserts 401"
      },
      "status": {
        "state": "verified",
        "guardrail": {
          "design": "HMAC validation middleware",
          "location": "src/webhooks/verify.ts:15-42",
          "implemented_by": "builder-session-002",
          "implemented_at": "2024-01-15T12:00:00Z"
        },
        "verification": {
          "method": "Executed repro steps",
          "evidence": "curl returned 401; DB unchanged",
          "verified_by": "verifier-session-003",
          "verified_at": "2024-01-15T14:20:00Z"
        }
      }
    }
  ]
}
```

### .failure-first/discoveries.json

```json
{
  "discoveries": [
    {
      "id": "D001",
      "description": "Race condition between concurrent webhook deliveries",
      "discovered_by": "builder-session-002",
      "discovered_at": "2024-01-15T13:00:00Z",
      "disposition": "pending"
    }
  ]
}
```

---

## Principles

1. **Adversary cannot implement.** Prevents bias toward solvable failures.

2. **Builder cannot verify.** Prevents self-certification.

3. **Verifier requires evidence.** Assertions are not verification.

4. **Frozen means frozen.** Mid-run changes go to discoveries, not spec.

5. **Human accepts risk.** Agents cannot skip verification.

6. **Completion is mechanical.** State machine, not judgment call.
