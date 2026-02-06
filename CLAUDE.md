# Failure-First Harness

This repository defines the Failure-First Harness, a governance architecture for reliable AI-assisted software development.

## Skills

### /FailFirst

Separation of powers for agentic coding. Separates enumeration, implementation, and verification into distinct phases with restricted permissions and required evidence.

**Usage:**
```
/FailFirst              # Start new harness or resume current phase
/FailFirst adversary    # Enumerate failures (cannot implement)
/FailFirst builder      # Implement guardrails (cannot verify)
/FailFirst verifier     # Verify with evidence (adversarial)
/FailFirst status       # Show current state
/FailFirst report       # Generate status report
```

**Workflow:**
1. Run `/FailFirst adversary` to enumerate failures for a feature
2. Freeze the spec when complete
3. Run `/FailFirst builder` to implement guardrails (one at a time, commit after each)
4. Run `/FailFirst verifier` to verify claims with evidence
5. Repeat builder/verifier until all critical failures are verified

**State machine:**
```
UNADDRESSED → IN_PROGRESS → CLAIMED → VERIFIED
                              ↓
                         (rejected)
```

**Key constraints:**
- Adversary cannot suggest implementations
- Builder cannot set VERIFIED (only CLAIMED)
- Verifier must provide evidence, not assertions
- Frozen spec cannot be modified (discoveries go to separate file)
- Risk acceptance requires human authority

See `.claude/skills/fail-first.md` for full skill definition.

## Project Structure

```
.
├── README.md                 # Full harness documentation
├── CLAUDE.md                 # This file
└── .claude/
    ├── settings.json         # Skill registration
    ├── skills/
    │   └── fail-first.md     # /FailFirst skill definition
    └── templates/
        ├── webhook-receiver.yaml   # Stripe, GitHub webhooks
        ├── authentication.yaml     # Login, sessions, MFA
        ├── file-upload.yaml        # Images, documents
        └── api-endpoint.yaml       # REST/GraphQL CRUD
```

## Templates

Use templates during adversary phase to ensure comprehensive failure coverage:

```
/FailFirst adversary
```

Then reference the relevant template. For a webhook receiver:

> "Use the webhook-receiver template categories to enumerate failures comprehensively."

The templates define failure classes with `must_consider` items and `oracle_patterns` to guide enumeration.

## Core Thesis

Reliability in AI-assisted development is a governance problem, not a prompting problem.

The harness applies separation of powers:
1. A role that defines what can go wrong (frozen before implementation)
2. A role that implements fixes (cannot certify its own work)
3. A role that verifies via adversarial evidence (independent, with execution tools)
4. A role that resolves disputes and accepts risk (human authority)

## FailureSpec v1.0

The harness uses a standardized failure specification format. See README.md for full schema.

Required fields per failure:
- `id`: Unique identifier (F001, F002, etc.)
- `title`: Short name
- `severity`: critical | high | medium | low
- `oracle`: What must be true when fixed (testable assertion)
- `repro`: Steps to trigger the failure
- `evidence`: What type of proof is required for verification
