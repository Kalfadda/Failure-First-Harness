# Email Template for Academic Researchers

Use this for software engineering or AI researchers at universities.

---

**Subject:** Research on AI agent reliability: role separation improves bug detection by 47pp

---

Dear Professor [Name],

I came across your work on [their specific research area] and thought you might find this relevant.

I've been investigating why AI coding assistants exhibit high false completion rates—claiming tasks are done while bugs remain. The hypothesis: this is a governance problem, not a capability problem.

**Approach:** Apply separation of powers to agentic workflows:
- Separate adversary (enumerates failures) from builder (implements) from verifier (validates)
- Enforce constraints: builder cannot self-verify, verifier must provide evidence

**Results across 36 ground-truth failures:**
| Condition | Coverage | False Completion |
|-----------|----------|------------------|
| Single Agent | 30.1% | 69.9% |
| Role-Separated Harness | 77.2% | 22.8% |

The methodology and all test code is open source:
https://github.com/Kalfadda/Failure-First-Harness

I'm working on formalizing this for publication and would value any feedback on the methodology or framing. The results are reproducible via a single command.

Best regards,
[Your name]

---

## Personalization Notes

**For SE researchers:** Emphasize connection to threat modeling, change control, separation of duties

**For AI/ML researchers:** Emphasize the structural constraint angle, connection to RLHF limitations

**For AI Safety researchers:** Frame as "governance mechanisms for reliable AI agents"

---

## Suggested Recipients

| Name | Affiliation | Research Area | Email |
|------|-------------|---------------|-------|
| Michael Ernst | U Washington | Software testing, verification | mernst@cs.washington.edu |
| Claire Le Goues | CMU | Automated program repair | clegoues@cs.cmu.edu |
| Sumit Gulwani | Microsoft Research | Program synthesis | sumitg@microsoft.com |
| Percy Liang | Stanford | Foundation models | pliang@cs.stanford.edu |
| Armando Solar-Lezama | MIT | Program synthesis | asolar@csail.mit.edu |

*Verify emails before sending—these may be outdated*
