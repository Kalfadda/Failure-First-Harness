# Case Study: Webhook Receiver

This case study demonstrates the Failure-First Harness catching a real vulnerability.

## Summary

| Phase | Outcome |
|-------|---------|
| Adversary | Identified 4 failure modes |
| Builder (vulnerable) | Implemented without signature validation |
| Verifier | **CAUGHT F001**: Test failed, vulnerability detected |
| Builder (fixed) | Added HMAC-SHA256 validation + replay protection |
| Verifier | All tests pass |

## The Vulnerability

The initial implementation (`src/webhook-vulnerable.js`) accepts any POST request to `/webhook` and processes it without verifying the signature. This allows attackers to forge arbitrary payment events.

```javascript
// VULNERABLE: No signature validation!
function handleWebhook(req, res) {
  // ... processes event without checking X-Signature
}
```

## Running the Demonstration

### 1. Run test against vulnerable code

```bash
node test/f001.test.js
```

**Output:**
```
=== TEST FAILED ===
VULNERABILITY DETECTED: Unsigned request returned 200, expected 401
The webhook endpoint accepts requests without signature validation!
This allows attackers to forge arbitrary webhook events.
```

### 2. Run test against secure code

```bash
node test/f001-secure.test.js
```

**Output:**
```
=== All tests passed ===
```

## Failures Identified

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| F001 | Missing signature validation | critical | Fixed |
| F002 | Timing attack on comparison | high | Fixed |
| F003 | Replay attack | high | Fixed |
| F004 | No body size limit | medium | Fixed |

## The Fix

The secure implementation (`src/webhook-secure.js`) addresses all identified failures:

1. **F001**: Requires valid HMAC-SHA256 signature
2. **F002**: Uses `crypto.timingSafeEqual` for constant-time comparison
3. **F003**: Tracks event IDs and rejects duplicates
4. **F004**: Limits request body to 1MB

## Key Takeaway

**The harness caught a real vulnerability through executable tests, not assertions.**

The verifier phase produced observable evidence:
- Unsigned request returned 200 (should be 401)
- State was modified without authentication
- Test failure message identified the exact security impact

Without the harness structure:
- A single-agent workflow might claim "signature validation implemented" without tests
- A builder-only workflow might verify its own work and find it satisfactory
- The vulnerability would ship to production

With the harness:
- The FailureSpec defined the oracle: "unsigned requests return 401"
- The verifier executed tests that triggered the failure
- The vulnerability was caught before deployment
