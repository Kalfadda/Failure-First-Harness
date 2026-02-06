/**
 * SECURE Webhook Receiver
 *
 * This implementation addresses the failures identified in the FailureSpec:
 * - F001: Signature validation with HMAC-SHA256
 * - F002: Constant-time comparison via timingSafeEqual
 * - F003: Replay protection via event ID tracking
 * - F004: Request body size limit
 */

const http = require('http');
const crypto = require('crypto');

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_test_secret_key_12345';
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Simulated database
const orders = new Map();
const processedEvents = new Map(); // For replay protection

/**
 * F001 + F002: Validate HMAC signature using constant-time comparison
 */
function validateSignature(payload, signature, secret) {
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // F002: Use constant-time comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (e) {
    return false;
  }
}

/**
 * F003: Check for replay attacks
 */
function isReplay(eventId, timestamp) {
  if (!eventId) return true;

  // Check if we've seen this event
  if (processedEvents.has(eventId)) {
    return true;
  }

  // Check timestamp is within acceptable window
  const eventTime = new Date(timestamp).getTime();
  const now = Date.now();
  if (isNaN(eventTime) || Math.abs(now - eventTime) > REPLAY_WINDOW_MS) {
    return true;
  }

  return false;
}

function markProcessed(eventId) {
  processedEvents.set(eventId, Date.now());

  // Clean up old entries
  const cutoff = Date.now() - REPLAY_WINDOW_MS;
  for (const [id, time] of processedEvents) {
    if (time < cutoff) {
      processedEvents.delete(id);
    }
  }
}

function handleWebhook(req, res, secret = WEBHOOK_SECRET) {
  let body = '';
  let bodySize = 0;

  req.on('data', chunk => {
    bodySize += chunk.length;

    // F004: Reject oversized payloads
    if (bodySize > MAX_BODY_SIZE) {
      res.writeHead(413);
      res.end('Payload too large');
      req.destroy();
      return;
    }

    body += chunk;
  });

  req.on('end', () => {
    // F001: Require signature
    const signature = req.headers['x-signature'];
    if (!validateSignature(body, signature, secret)) {
      res.writeHead(401);
      res.end('Invalid signature');
      return;
    }

    // Parse JSON
    let event;
    try {
      event = JSON.parse(body);
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid JSON');
      return;
    }

    // F003: Check for replay
    if (isReplay(event.id, event.timestamp)) {
      res.writeHead(409);
      res.end('Duplicate event');
      return;
    }

    // Mark as processed before handling
    markProcessed(event.id);

    // Process the event
    if (event.type === 'payment.completed') {
      const orderId = event.data?.order_id;
      if (orderId) {
        orders.set(orderId, { status: 'paid', amount: event.data.amount });
        console.log(`Order ${orderId} marked as paid`);
      }
    }

    res.writeHead(200);
    res.end('OK');
  });
}

function createServer(port = 3000, secret = WEBHOOK_SECRET) {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
      handleWebhook(req, res, secret);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.orders = orders;
  server.processedEvents = processedEvents;
  server.secret = secret;

  return server;
}

// Helper to generate valid signatures for testing
function signPayload(payload, secret = WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

module.exports = { createServer, handleWebhook, signPayload, validateSignature };

// Run if executed directly
if (require.main === module) {
  const server = createServer();
  server.listen(3000, () => {
    console.log('Secure webhook server running on port 3000');
    console.log('Signature validation: ENABLED');
    console.log('Replay protection: ENABLED');
    console.log('Size limit: 1MB');
  });
}
