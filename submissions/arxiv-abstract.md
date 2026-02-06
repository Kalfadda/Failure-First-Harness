# arXiv Preprint Draft

## Metadata

**Title:** Failure-First Harness: Structural Role Separation for Reliable AI-Assisted Software Development

**Authors:** [Your name]

**Categories:** cs.SE (Software Engineering), cs.AI (Artificial Intelligence)

**Keywords:** AI agents, software engineering, reliability, verification, governance, LLM

---

## Abstract

Large language model-based coding assistants exhibit high false completion rates, claiming tasks are finished while critical failures remain unaddressed. We hypothesize this is a governance problem—structural conflicts of interest—rather than a capability limitation. We introduce the Failure-First Harness, a three-role architecture that enforces separation of powers: an adversary role that enumerates failure modes (prohibited from suggesting implementations), a builder role that implements guardrails (prohibited from self-verification), and a verifier role that validates claims (required to provide executable evidence). We evaluate this approach across 36 ground-truth failures in three domains: password reset security, shopping cart state machines, and adversarial "deceptive" code that appears secure but contains subtle vulnerabilities. Results show single-agent approaches achieve 30.1% failure coverage with 69.9% false completion, while the role-separated harness achieves 77.2% coverage with 22.8% false completion—an improvement of 47.1 percentage points. The effect is most pronounced for deceptive code (9.6% vs 58.8% detection) and race conditions (3% vs 67% detection). We provide open-source implementations of all experiments with deterministic, reproducible results. Our findings suggest that structural constraints on agent roles may be as important as model capability for reliable AI-assisted development.

---

## Paper Outline

### 1. Introduction
- The false completion problem in AI coding assistants
- Thesis: governance problem, not capability problem
- Contributions: harness design, stress test methodology, empirical validation

### 2. Related Work
- Threat modeling (STRIDE, PASTA)
- Separation of duties in security/finance
- Multi-agent systems
- LLM agent frameworks
- AI safety and alignment

### 3. The Failure-First Harness
- 3.1 Role definitions and constraints
- 3.2 State machine for failure lifecycle
- 3.3 FailureSpec schema
- 3.4 Enforcement mechanisms

### 4. Experimental Design
- 4.1 Ground truth construction
- 4.2 Three test domains
- 4.3 Conditions (A: single, B: two-agent, C: harness)
- 4.4 Metrics (coverage, false completion, verification rate)

### 5. Results
- 5.1 Overall coverage comparison
- 5.2 Domain-specific analysis
- 5.3 Category breakdown (race, validation, deception)
- 5.4 Deception level analysis

### 6. Discussion
- 6.1 Why separation works
- 6.2 Limitations and threats to validity
- 6.3 Overhead considerations
- 6.4 Generalization to other domains

### 7. Conclusion
- Summary of findings
- Implications for AI agent design
- Future work (Condition D, human-in-the-loop, production study)

### References

### Appendix
- A. Full FailureSpec schema
- B. Ground truth failure lists
- C. Reproduction instructions

---

## Submission Notes

**Primary venue:** arXiv (cs.SE)

**Secondary venues to consider:**
- ICSE 2025 (deadline typically September)
- FSE 2025 (deadline typically March)
- ASE 2024/2025
- NeurIPS Workshop on Foundation Models
- AAAI (AI safety framing)

**Page limit:** arXiv has none; conferences typically 10-12 pages

**Estimated writing time:** 2-3 weeks for full paper

---

## Key Claims to Support

| Claim | Evidence in Repo |
|-------|------------------|
| Single agents miss 70% of bugs | stress-tests/combined-results.json |
| Harness improves to 77% | stress-tests/combined-results.json |
| C > B > A across all tests | All three experiment.js files |
| Deceptive code shows largest gap | adversarial-redteam/experiment.js |
| Race conditions poorly detected by single agents | shopping-cart category analysis |
| Results are reproducible | run-all-experiments.js |
