# Hacker News Submission

## Title (80 char limit)
```
Show HN: Failure-First Harness – Role separation cuts AI agent bugs from 70% to 23%
```

**Alternative titles:**
- `Show HN: Single AI agents miss 70% of bugs. Structural role separation fixes it`
- `Show HN: We validated that separating AI agent roles improves reliability by 47pp`

---

## Post URL
```
https://github.com/Kalfadda/Failure-First-Harness
```

---

## First Comment (Post immediately after submission)

I built this after noticing a pattern: AI coding assistants claim "done" while critical bugs remain. The issue isn't capability—it's structural. The agent that identifies problems is biased toward solvable problems. The agent that implements is biased toward "looks complete." The agent that verifies is biased toward confirming its own work.

Better prompts don't fix conflicts of interest.

**The approach:** Separate roles with enforced constraints:
- Adversary: enumerates what can go wrong (cannot implement)
- Builder: implements fixes (cannot verify its own work)
- Verifier: validates with evidence (cannot skip proof)

**What we tested:** 36 ground-truth failures across 3 domains:
1. Password reset security (token handling, rate limiting, sessions)
2. Shopping cart state machine (race conditions, inventory, transactions)
3. Adversarial red team (code that LOOKS secure but isn't)

**Results:**
- Single agent: 30.1% coverage, 69.9% false completion
- Harness: 77.2% coverage, 22.8% false completion
- Improvement: +47.1 percentage points

The most striking result: for "deceptive" secure-looking code, single agents caught only 9.6% of vulnerabilities. The harness caught 58.8%.

Everything is reproducible:
```
git clone https://github.com/Kalfadda/Failure-First-Harness
node stress-tests/run-all-experiments.js
```

Happy to answer questions about the methodology, limitations, or where this breaks down.

---

## Timing Recommendations

**Best days:** Tuesday, Wednesday, Thursday
**Best times:** 9:00-11:00 AM Eastern (6:00-8:00 AM Pacific)
**Avoid:** Weekends, Monday mornings, Friday afternoons

---

## Expected Questions & Answers

**Q: Isn't this just threat modeling + code review?**
A: Yes, exactly. The insight is that these human practices work for AI agents too—but only if structurally enforced. An AI agent that threat models AND implements AND verifies has the same conflict of interest a human developer would.

**Q: What's the overhead?**
A: Real but not measured precisely yet. For security-critical features, the reliability gain is worth it. For prototypes, skip it.

**Q: Same model for all roles—doesn't that share blind spots?**
A: Yes. We haven't tested Condition D (different verifier model) yet. That's on the roadmap. The structural separation still helps because the adversary is prompted to attack, not defend.

**Q: Why not just write better tests?**
A: Tests verify what you think of. The adversary phase forces enumeration of failure modes before implementation. You test for things you wouldn't have thought to test.

**Q: Is this peer reviewed?**
A: Not yet. The methodology and results are public and reproducible. Working on an arXiv preprint.
