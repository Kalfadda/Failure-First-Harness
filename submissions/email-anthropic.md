# Email to Anthropic Research

**To:** research@anthropic.com
**Subject:** Validated approach to AI agent reliability: 47pp improvement via role separation

---

Hi,

I've been working on AI agent reliability and wanted to share results that might be relevant to Anthropic's work on Claude and agentic systems.

**The problem:** Single-agent coding assistants exhibit high false completion rates—claiming tasks are done while critical failures remain unaddressed. In our testing, single agents missed 70% of ground-truth bugs.

**The approach:** We applied separation of powers to agentic workflows:
- Adversary role: enumerates failure modes (cannot implement)
- Builder role: implements guardrails (cannot verify its own work)
- Verifier role: validates with evidence (must provide proof)

**The results:** Across 36 ground-truth failures in 3 domains:
- Single agent: 30.1% coverage
- Role-separated harness: 77.2% coverage
- Improvement: +47.1 percentage points

The most significant finding: for code that *appears* secure but contains subtle vulnerabilities, single agents caught only 9.6%. The harness caught 58.8%.

Everything is open source and reproducible:
https://github.com/Kalfadda/Failure-First-Harness

```
git clone https://github.com/Kalfadda/Failure-First-Harness
node stress-tests/run-all-experiments.js
```

I built this using Claude, and the results suggest that governance mechanisms (who can do what, with what evidence) may be as important as model capability for agent reliability.

Would love to discuss if this is relevant to any of your current research directions.

Best,
[Your name]

---

## Notes

- Keep it short—researchers are busy
- Lead with the finding, not the story
- Make reproducibility obvious
- Don't ask for anything specific—let them respond with interest
