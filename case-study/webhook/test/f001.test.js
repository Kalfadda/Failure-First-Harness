/**
 * Test for F001: Missing signature validation (SECURE version)
 *
 * Oracle: Requests without valid X-Signature header return 401
 *         and do not modify state
 *
 * This test verifies the fix works.
 */

const http = require('http');
const { createServer, signPayload } = require('../src/webhook-secure');

const TEST_PORT = 3098;
const TEST_SECRET = 'test-secret-key';

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

  const server = createServer(TEST_PORT, TEST_SECRET);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    const payload = JSON.stringify({
      id: 'evt_test_001',
      type: 'payment.completed',
      timestamp: new Date().toISOString(),
      data: { order_id: 'test-001', amount: 100 }
    });

    const response = await makeRequest({}, payload);

    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }

    if (server.orders.has('test-001')) {
      throw new Error('State was modified despite missing signature');
    }

    console.log('PASS: Unsigned request rejected');
  } finally {
    server.close();
  }
}

async function test_invalid_signature_rejected() {
  console.log('Test: Invalid signature should be rejected with 401');

  const server = createServer(TEST_PORT, TEST_SECRET);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    const payload = JSON.stringify({
      id: 'evt_test_002',
      type: 'payment.completed',
      timestamp: new Date().toISOString(),
      data: { order_id: 'test-002', amount: 200 }
    });

    const response = await makeRequest({
      headers: { 'X-Signature': 'invalid-signature-12345' }
    }, payload);

    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }

    console.log('PASS: Invalid signature rejected');
  } finally {
    server.close();
  }
}

async function test_valid_signature_accepted() {
  console.log('Test: Valid signature should be accepted');

  const server = createServer(TEST_PORT, TEST_SECRET);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    const payload = JSON.stringify({
      id: 'evt_test_003',
      type: 'payment.completed',
      timestamp: new Date().toISOString(),
      data: { order_id: 'test-003', amount: 300 }
    });

    const signature = signPayload(payload, TEST_SECRET);

    const response = await makeRequest({
      headers: { 'X-Signature': signature }
    }, payload);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    if (!server.orders.has('test-003')) {
      throw new Error('State was not modified with valid signature');
    }

    console.log('PASS: Valid signature accepted');
  } finally {
    server.close();
  }
}

async function test_replay_rejected() {
  console.log('Test: Replay of valid request should be rejected');

  const server = createServer(TEST_PORT, TEST_SECRET);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    const payload = JSON.stringify({
      id: 'evt_test_004',
      type: 'payment.completed',
      timestamp: new Date().toISOString(),
      data: { order_id: 'test-004', amount: 400 }
    });

    const signature = signPayload(payload, TEST_SECRET);

    // First request should succeed
    const response1 = await makeRequest({
      headers: { 'X-Signature': signature }
    }, payload);

    if (response1.status !== 200) {
      throw new Error(`First request failed: ${response1.status}`);
    }

    // Second identical request should be rejected
    const response2 = await makeRequest({
      headers: { 'X-Signature': signature }
    }, payload);

    if (response2.status !== 409) {
      throw new Error(`Expected 409 for replay, got ${response2.status}`);
    }

    console.log('PASS: Replay rejected');
  } finally {
    server.close();
  }
}

// Run tests with single server
async function runTests() {
  console.log('=== F001 Signature Validation Tests (SECURE) ===');
  console.log('Testing: webhook-secure.js');
  console.log('');

  const server = createServer(TEST_PORT, TEST_SECRET);
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // Test 1: Unsigned request rejected
    console.log('Test: Unsigned request should be rejected with 401');
    {
      const payload = JSON.stringify({
        id: 'evt_test_001',
        type: 'payment.completed',
        timestamp: new Date().toISOString(),
        data: { order_id: 'test-001', amount: 100 }
      });

      const response = await makeRequest({}, payload);
      if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
      if (server.orders.has('test-001')) throw new Error('State modified without signature');
      console.log('PASS: Unsigned request rejected');
    }

    // Test 2: Invalid signature rejected
    console.log('Test: Invalid signature should be rejected with 401');
    {
      const payload = JSON.stringify({
        id: 'evt_test_002',
        type: 'payment.completed',
        timestamp: new Date().toISOString(),
        data: { order_id: 'test-002', amount: 200 }
      });

      const response = await makeRequest({
        headers: { 'X-Signature': 'invalid-signature-12345' }
      }, payload);
      if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
      console.log('PASS: Invalid signature rejected');
    }

    // Test 3: Valid signature accepted
    console.log('Test: Valid signature should be accepted');
    {
      const payload = JSON.stringify({
        id: 'evt_test_003',
        type: 'payment.completed',
        timestamp: new Date().toISOString(),
        data: { order_id: 'test-003', amount: 300 }
      });

      const signature = signPayload(payload, TEST_SECRET);
      const response = await makeRequest({
        headers: { 'X-Signature': signature }
      }, payload);

      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!server.orders.has('test-003')) throw new Error('State not modified with valid signature');
      console.log('PASS: Valid signature accepted');
    }

    // Test 4: Replay rejected
    console.log('Test: Replay of valid request should be rejected');
    {
      const payload = JSON.stringify({
        id: 'evt_test_004',
        type: 'payment.completed',
        timestamp: new Date().toISOString(),
        data: { order_id: 'test-004', amount: 400 }
      });

      const signature = signPayload(payload, TEST_SECRET);

      const response1 = await makeRequest({
        headers: { 'X-Signature': signature }
      }, payload);
      if (response1.status !== 200) throw new Error(`First request failed: ${response1.status}`);

      const response2 = await makeRequest({
        headers: { 'X-Signature': signature }
      }, payload);
      if (response2.status !== 409) throw new Error(`Expected 409 for replay, got ${response2.status}`);
      console.log('PASS: Replay rejected');
    }

    console.log('');
    console.log('=== All tests passed ===');
    process.exit(0);
  } catch (e) {
    console.error('');
    console.error('=== TEST FAILED ===');
    console.error(e.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
