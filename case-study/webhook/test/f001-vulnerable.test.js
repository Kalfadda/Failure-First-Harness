/**
 * Test for F001: Missing signature validation
 *
 * Oracle: Requests without valid X-Signature header return 401
 *         and do not modify state
 *
 * This test demonstrates the harness catching a real vulnerability.
 */

const http = require('http');
const { createServer } = require('../src/webhook-vulnerable');

const TEST_PORT = 3099;

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function test_unsigned_request_rejected() {
  console.log('Test: Unsigned request should be rejected with 401');

  const server = createServer(TEST_PORT);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // Send unsigned request
    const payload = JSON.stringify({
      type: 'payment.completed',
      data: { order_id: 'test-001', amount: 100 }
    });

    const response = await makeRequest({}, payload);

    // Check response
    if (response.status !== 401) {
      throw new Error(
        `VULNERABILITY DETECTED: Unsigned request returned ${response.status}, expected 401\n` +
        `The webhook endpoint accepts requests without signature validation!\n` +
        `This allows attackers to forge arbitrary webhook events.`
      );
    }

    // Check state wasn't modified
    if (server.orders.has('test-001')) {
      throw new Error(
        `VULNERABILITY DETECTED: State was modified despite missing signature\n` +
        `Order test-001 was created without valid authentication.`
      );
    }

    console.log('PASS: Unsigned request rejected');
  } finally {
    server.close();
  }
}

async function test_invalid_signature_rejected() {
  console.log('Test: Invalid signature should be rejected with 401');

  const server = createServer(TEST_PORT);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    const payload = JSON.stringify({
      type: 'payment.completed',
      data: { order_id: 'test-002', amount: 200 }
    });

    const response = await makeRequest({
      headers: { 'X-Signature': 'invalid-signature-12345' }
    }, payload);

    if (response.status !== 401) {
      throw new Error(
        `VULNERABILITY DETECTED: Invalid signature accepted (status ${response.status})\n` +
        `The webhook endpoint does not validate signatures properly.`
      );
    }

    console.log('PASS: Invalid signature rejected');
  } finally {
    server.close();
  }
}

async function test_empty_signature_rejected() {
  console.log('Test: Empty signature should be rejected with 401');

  const server = createServer(TEST_PORT);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    const payload = JSON.stringify({
      type: 'payment.completed',
      data: { order_id: 'test-003', amount: 300 }
    });

    const response = await makeRequest({
      headers: { 'X-Signature': '' }
    }, payload);

    if (response.status !== 401) {
      throw new Error(
        `VULNERABILITY DETECTED: Empty signature accepted (status ${response.status})`
      );
    }

    console.log('PASS: Empty signature rejected');
  } finally {
    server.close();
  }
}

// Run tests
async function runTests() {
  console.log('=== F001 Signature Validation Tests ===');
  console.log('Testing: webhook-vulnerable.js');
  console.log('');

  try {
    await test_unsigned_request_rejected();
    await test_invalid_signature_rejected();
    await test_empty_signature_rejected();

    console.log('');
    console.log('=== All tests passed ===');
    process.exit(0);
  } catch (e) {
    console.error('');
    console.error('=== TEST FAILED ===');
    console.error(e.message);
    process.exit(1);
  }
}

runTests();
