# Twitter/X Thread

## Thread

**Tweet 1 (Hook):**
Single AI coding agents miss 70% of bugs while claiming "done."

We tested a fix: structural role separation.

Result: false completion dropped from 70% to 23%.

Here's what we found (reproducible, open source):

🧵

---

**Tweet 2 (The Problem):**
The issue isn't capability—it's conflict of interest.

The agent that identifies problems is biased toward *solvable* problems.
The agent that implements is biased toward "looks complete."
The agent that verifies is biased toward confirming its own work.

Better prompts don't fix this.

---

**Tweet 3 (The Solution):**
We applied separation of powers:

• Adversary: enumerates what can go wrong (CANNOT implement)
• Builder: implements fixes (CANNOT verify its own work)
• Verifier: validates with evidence (CANNOT skip proof)

These constraints are mechanically enforced.

---

**Tweet 4 (The Test):**
We tested across 36 ground-truth failures in 3 domains:

1. Password reset security
2. Shopping cart state machine
3. Adversarial "deceptive" code (LOOKS secure, isn't)

Each domain has 12 hidden failures. Can the agent find them?

---

**Tweet 5 (The Results):**
Results:

| Condition | Coverage |
|-----------|----------|
| Single Agent | 30.1% |
| Two-Agent | 49.9% |
| Role-Separated | 77.2% |

Improvement: +47 percentage points

The hypothesis (C > B > A) held across ALL tests.

---

**Tweet 6 (The Killer Finding):**
The most striking result:

For code that APPEARS secure but contains subtle vulnerabilities:

• Single agent: 9.6% detection
• Harness: 58.8% detection

Single agents see security checks and assume secure.
Adversarial prompting asks "how can these be bypassed?"

---

**Tweet 7 (Race Conditions):**
Race condition detection:

• Single agent: 3%
• Harness: 67%

Single agents focus on happy paths.
Adversarial enumeration forces: "what happens with concurrent access?"

---

**Tweet 8 (Reproducibility):**
Everything is reproducible:

```
git clone https://github.com/Kalfadda/Failure-First-Harness
node stress-tests/run-all-experiments.js
```

Run it yourself. Challenge the methodology.

All test code, ground truth, and analysis scripts are public.

---

**Tweet 9 (The Thesis):**
The thesis:

"Reliability in AI-assisted development is a governance problem, not a prompting problem."

Structure > prompts.
Constraints > capability.
Evidence > assertions.

---

**Tweet 10 (CTA):**
The repo: https://github.com/Kalfadda/Failure-First-Harness

What's next:
• Different verifier models (Condition D)
• Human-in-the-loop measurements
• Production case study

Feedback welcome. Poke holes in it.

---

## Accounts to Tag

**On Tweet 1 or 10:**
- @AnthropicAI
- @ClaudeAI

**Consider tagging (if appropriate):**
- @swyx (AI dev tooling)
- @simonw (LLM tooling, datasette)
- @kaboragzdev (AI engineering)
- @hardmaru (AI research)
- @goodlooseunits (AI safety)

---

## Hashtags (use sparingly, 1-2 per tweet max)
- #AIAgents
- #LLM
- #SoftwareEngineering
- #AISafety

---

## Timing
- Best: Tuesday-Thursday, 9-11am ET or 5-7pm ET
- Avoid: Weekends, major news days

---

## Images to Include

Consider creating:
1. Bar chart of the 3 conditions (A/B/C coverage)
2. Table screenshot of the results
3. Diagram of the 3-role separation

Visual tweets get 2-3x engagement.
