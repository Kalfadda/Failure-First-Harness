/**
 * VULNERABLE Webhook Receiver
 *
 * This implementation has intentional security flaws for demonstration:
 * - No signature validation
 * - Uses string comparison (timing attack vulnerable)
 * - No input validation
 */

const http = require('http');

// Simulated database
const orders = new Map();

function handleWebhook(req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    // VULNERABILITY: No signature validation at all!
    // Anyone can send fake webhook events

    let event;
    try {
      event = JSON.parse(body);
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid JSON');
      return;
    }

    // Process the event (trusting it blindly)
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

function createServer(port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
      handleWebhook(req, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.orders = orders; // Expose for testing

  return server;
}

module.exports = { createServer, handleWebhook };

// Run if executed directly
if (require.main === module) {
  const server = createServer();
  server.listen(3000, () => {
    console.log('Vulnerable webhook server running on port 3000');
    console.log('WARNING: This server has no signature validation!');
  });
}
