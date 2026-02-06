# Reddit Posts

## r/MachineLearning

**Title:** [R] Structural role separation improves AI agent reliability by 47pp - validated across 36 ground-truth failures

**Body:**

We tested whether separating AI agent roles (adversary/builder/verifier) with enforced constraints improves reliability compared to single-agent approaches.

**Setup:**
- 36 ground-truth failures across 3 domains (password reset, shopping cart, adversarial red team)
- 3 conditions: single agent, two-agent, role-separated harness
- Deterministic, reproducible experiments

**Results:**

| Condition | Coverage | False Completion |
|-----------|----------|------------------|
| Single Agent | 30.1% | 69.9% |
| Two-Agent | 49.9% | 50.1% |
| Role-Separated | 77.2% | 22.8% |

**Key findings:**
- Race condition detection: 3% (single) vs 67% (harness)
- Deceptive "secure-looking" code: 9.6% (single) vs 58.8% (harness)
- Hypothesis C > B > A held across all 3 test domains

**The mechanism:** Constraints matter more than capability. The builder cannot self-verify. The verifier must provide evidence. These are mechanically enforced.

Repo with all tests: https://github.com/Kalfadda/Failure-First-Harness

```
git clone https://github.com/Kalfadda/Failure-First-Harness
node stress-tests/run-all-experiments.js
```

Limitations acknowledged in the repo. Feedback on methodology welcome.

---

## r/LocalLLaMA

**Title:** Tested role separation for coding agents - 47pp improvement in bug detection

**Body:**

Been working on making AI coding assistants more reliable. The problem: they claim "done" while bugs remain.

**What I tried:** Instead of one agent doing everything, separate into:
- Adversary: lists what can go wrong (can't write code)
- Builder: writes the fix (can't verify itself)
- Verifier: checks with evidence (can't skip proof)

**Tested on:** 36 hidden bugs across password reset, shopping cart, and "deceptive secure code" scenarios.

**Results:**
- Single agent finds 30% of bugs
- Role-separated finds 77%
- False "done" claims drop from 70% to 23%

The biggest gap: code that LOOKS secure. Single agents catch 9.6%. Harness catches 58.8%.

Everything's open source and reproducible:
https://github.com/Kalfadda/Failure-First-Harness

Run `node stress-tests/run-all-experiments.js` to see for yourself.

Works with any model. The key is the structure, not the model.

---

## r/programming

**Title:** We tested why AI coding assistants miss bugs - it's a governance problem, not a capability problem

**Body:**

AI coding assistants have a pattern: they claim "done" while obvious bugs remain. We tested why and found a fix.

**The problem:** Same agent identifies problems, implements fixes, and verifies. That's a conflict of interest. It's biased toward "looks complete."

**The fix:** Separation of powers (like in orgs that work):
- One role enumerates what can go wrong
- One role implements
- One role verifies with actual evidence

**We tested it:** 36 ground-truth bugs, 3 domains, reproducible experiments.

**Results:**
- Single agent: catches 30% of bugs, claims done
- Role-separated: catches 77% of bugs

The structure matters more than the prompts.

Repo: https://github.com/Kalfadda/Failure-First-Harness

The stress tests are runnable. Challenge the methodology.

---

## r/ExperiencedDevs

**Title:** Applied separation of duties to AI coding agents - results from testing on 36 ground-truth bugs

**Body:**

Those of us who've worked in regulated industries know separation of duties: the person who writes the code can't approve it for production.

I applied this to AI coding agents and tested whether it actually helps.

**The pattern:**
- Adversary phase: enumerate failure modes (threat modeling)
- Builder phase: implement (can't self-approve)
- Verifier phase: validate with evidence (independent review)

**Tested against:** 36 hidden bugs across security (password reset), state machines (shopping cart), and deceptive code (looks secure, isn't).

**Results:**
| Approach | Bugs Found | "Done" But Buggy |
|----------|------------|------------------|
| Single Agent | 30% | 70% |
| Separated Roles | 77% | 23% |

Race conditions especially: 3% detection (single) vs 67% (separated).

The methodology is open source: https://github.com/Kalfadda/Failure-First-Harness

Not claiming this solves everything. Overhead is real. But for security-critical features, the reliability gain seems worth it.

Interested in feedback from folks who've tried similar patterns.
