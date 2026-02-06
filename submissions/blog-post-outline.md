# Blog Post Outline

**Platforms:** Dev.to, Medium, Hashnode, personal blog

**Title options:**
- "Why AI Coding Assistants Miss 70% of Bugs (And How to Fix It)"
- "The Governance Problem in AI Agents: Role Separation for Reliability"
- "We Tested Separation of Powers for AI Agents. Here's What Happened."

---

## Structure

### Hook (1 paragraph)
AI coding assistants have a dirty secret: they claim "done" while 70% of bugs remain unfixed. We tested a fix based on an old idea—separation of powers—and cut false completion from 70% to 23%. Here's the data.

### The Problem (2-3 paragraphs)
- Story: describe a typical failure (agent implements, self-verifies, ships bug)
- The pattern: same agent identifies → implements → verifies
- Why prompts don't fix it: structural conflict of interest

### The Thesis (1 paragraph)
Reliability in AI-assisted development is a governance problem, not a prompting problem. Structure > prompts.

### The Solution (3-4 paragraphs)
- Three roles: Adversary, Builder, Verifier
- Key constraints: who CANNOT do what
- The state machine: UNADDRESSED → CLAIMED → VERIFIED
- Why constraints matter more than capability

### The Test (2-3 paragraphs)
- 36 ground-truth failures, 3 domains
- How we built the stress tests
- What "coverage" and "false completion" mean

### The Results (3-4 paragraphs)
- The table: A=30%, B=50%, C=77%
- Domain breakdown
- The killer finding: deceptive code (9.6% vs 58.8%)
- Race conditions (3% vs 67%)

### Why It Works (2-3 paragraphs)
- Adversarial enumeration forces coverage
- Separation prevents self-certification
- Evidence requirement prevents rubber-stamping

### Limitations (1-2 paragraphs)
- Same model shares blind spots
- Overhead is real
- Not tested at production scale

### Try It Yourself (1 paragraph)
```
git clone ...
node stress-tests/run-all-experiments.js
```
Link to repo.

### What's Next (1 paragraph)
- Different verifier model testing
- Human-in-the-loop
- Production case study

### Call to Action
- Star the repo
- Try it on your project
- Poke holes in the methodology

---

## Images to Create

1. **Bar chart:** Coverage by condition (A/B/C)
2. **Diagram:** The three roles with constraints
3. **State machine:** Failure lifecycle
4. **Table screenshot:** Combined results
5. **Category heatmap:** Detection rates by category and condition

---

## Code Snippets to Include

```javascript
// The adversary cannot implement
// The builder cannot verify
// The verifier must provide evidence

// State machine
UNADDRESSED → IN_PROGRESS → CLAIMED → VERIFIED
                               ↓
                          (rejected)
```

```bash
# Reproduce the results
git clone https://github.com/Kalfadda/Failure-First-Harness
node stress-tests/run-all-experiments.js
```

---

## SEO Keywords

- AI coding assistant reliability
- LLM agent bugs
- Multi-agent systems
- AI software engineering
- Claude Code
- AI testing
- Agent governance

---

## Cross-posting Strategy

1. **Publish first:** Personal blog or Dev.to (for canonical URL)
2. **Cross-post:** Medium (larger audience)
3. **Share on:** Twitter thread pointing to full post, Reddit with summary
4. **Wait 24 hours:** Then submit to Hacker News with blog link
