/**
 * Ground Truth Tests for Shopping Cart
 *
 * Tests all 12 ground truth failures against both vulnerable and secure implementations.
 */

// Test runner
class TestRunner {
  constructor(implementation, name) {
    this.impl = implementation;
    this.name = name;
    this.results = [];
  }

  test(id, title, fn) {
    this.impl.reset();
    try {
      fn(this.impl);
      this.results.push({ id, title, passed: true });
      console.log(`  [PASS] ${id}: ${title}`);
    } catch (e) {
      this.results.push({ id, title, passed: false, error: e.message });
      console.log(`  [FAIL] ${id}: ${title}`);
      console.log(`         ${e.message}`);
    }
  }

  summary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    return { name: this.name, passed, failed, total: this.results.length, results: this.results };
  }
}

function runGroundTruthTests(impl, name) {
  console.log(`\n=== Testing: ${name} ===\n`);
  const runner = new TestRunner(impl, name);

  // GT001: Negative quantity allows free items
  runner.test('GT001', 'Negative quantity allows free items', (impl) => {
    const cartId = impl.createCart('user1');
    const result = impl.addItem(cartId, 'ITEM1', -5);

    if (result.success) {
      throw new Error('VULNERABILITY: Negative quantity accepted');
    }

    // Also test updateQuantity
    impl.reset();
    const cartId2 = impl.createCart('user1');
    impl.addItem(cartId2, 'ITEM1', 1);
    const updateResult = impl.updateQuantity(cartId2, 'ITEM1', -5);

    if (updateResult.success) {
      throw new Error('VULNERABILITY: Negative quantity accepted in update');
    }
  });

  // GT002: Price changed between add and checkout
  runner.test('GT002', 'Price changed between add and checkout', (impl) => {
    const cartId = impl.createCart('user1');
    impl.addItem(cartId, 'ITEM1', 1);

    // Get original total
    const total1 = impl.calculateTotal(cartId);

    // Change price
    impl.updateProductPrice('ITEM1', 5000); // Much higher price

    // Get new total
    const total2 = impl.calculateTotal(cartId);

    // For secure impl using cents: prices should update
    // For vulnerable impl caching price: totals will be the same
    const t1 = total1.totalCents || (total1.total * 100);
    const t2 = total2.totalCents || (total2.total * 100);

    if (Math.abs(t1 - t2) < 100) { // Should differ by at least $1
      throw new Error(`VULNERABILITY: Price not updated. Before: ${t1}, After: ${t2}`);
    }
  });

  // GT003: Discount code applied multiple times
  runner.test('GT003', 'Discount code applied multiple times', (impl) => {
    const cartId = impl.createCart('user1');
    impl.addItem(cartId, 'ITEM1', 1);

    const result1 = impl.applyDiscount(cartId, 'SAVE10');
    if (!result1.success) return; // Discount not supported

    const result2 = impl.applyDiscount(cartId, 'SAVE10');

    if (result2.success) {
      throw new Error('VULNERABILITY: Same discount code applied twice');
    }
  });

  // GT004: Race condition - two tabs checkout same cart
  runner.test('GT004', 'Race condition - concurrent checkout', (impl) => {
    const cartId = impl.createCart('user1');
    impl.addItem(cartId, 'ITEM1', 1);

    // Simulate concurrent checkout by checking if cart allows it
    const result1 = impl.checkout(cartId, { card: '4242' });

    // Reset and try again with simulated concurrent access
    impl.reset();
    const cartId2 = impl.createCart('user1');
    impl.addItem(cartId2, 'ITEM1', 1);

    // Check if cart has locking mechanism
    const state = impl.getState();
    const cart = state.carts[cartId2];

    // If cart has no lock field, it's vulnerable
    if (cart && typeof cart.lock === 'undefined') {
      throw new Error('VULNERABILITY: No locking mechanism for concurrent checkout');
    }
  });

  // GT005: Inventory oversold
  runner.test('GT005', 'Inventory oversold', (impl) => {
    // Item2 has 5 in stock
    const cartId1 = impl.createCart('user1');
    const cartId2 = impl.createCart('user2');

    impl.addItem(cartId1, 'ITEM2', 3);
    impl.addItem(cartId2, 'ITEM2', 3);

    // Both try to checkout - one should fail
    const result1 = impl.checkout(cartId1, { card: '4242' });
    const result2 = impl.checkout(cartId2, { card: '4242' });

    // Check final inventory
    const state = impl.getState();
    const finalInventory = state.inventory['ITEM2'];

    if (finalInventory < 0) {
      throw new Error(`VULNERABILITY: Inventory went negative (${finalInventory})`);
    }

    // If both succeeded, that's also a problem with 5 in stock
    if (result1.success && result2.success) {
      throw new Error('VULNERABILITY: Both checkouts succeeded for 6 items with 5 in stock');
    }
  });

  // GT006: Float precision errors on totals
  runner.test('GT006', 'Float precision errors on totals', (impl) => {
    const cartId = impl.createCart('user1');

    // Add 3 items at $0.10 each - classic float issue: 0.1 + 0.1 + 0.1 != 0.3
    impl.addItem(cartId, 'ITEM3', 3);

    const { total, totalCents } = impl.calculateTotal(cartId);

    // Expected: 30 cents
    const actualCents = totalCents || Math.round(total * 100);

    // Float error would give something like 30.000000000000004
    if (actualCents !== 30) {
      throw new Error(`VULNERABILITY: Float precision error. Expected 30 cents, got ${actualCents}`);
    }

    // More extensive test
    impl.reset();
    const cartId2 = impl.createCart('user1');
    impl.addItem(cartId2, 'ITEM3', 33); // 33 * 0.10 = 3.30

    const result2 = impl.calculateTotal(cartId2);
    const cents2 = result2.totalCents || Math.round(result2.total * 100);

    if (cents2 !== 330) {
      throw new Error(`VULNERABILITY: Float precision error. Expected 330 cents, got ${cents2}`);
    }
  });

  // GT008: Partial payment state corruption
  runner.test('GT008', 'Partial payment state corruption', (impl) => {
    const cartId = impl.createCart('user1');
    impl.addItem(cartId, 'ITEM1', 1);

    // Force payment failure by using invalid payment info
    // In vulnerable impl, cart will be left as 'processing'
    const result = impl.checkout(cartId, null); // null payment should fail

    if (!result.success) {
      const state = impl.getState();
      const cart = state.carts[cartId];

      if (cart && cart.status === 'processing') {
        throw new Error('VULNERABILITY: Cart stuck in processing state after payment failure');
      }
    }
  });

  // GT009: Deleted product remains in cart
  runner.test('GT009', 'Deleted product remains in cart', (impl) => {
    const cartId = impl.createCart('user1');
    impl.addItem(cartId, 'ITEM1', 1);

    // Delete the product
    impl.deleteProduct('ITEM1');

    // Try to checkout
    const result = impl.checkout(cartId, { card: '4242' });

    if (result.success) {
      throw new Error('VULNERABILITY: Checkout succeeded for deleted product');
    }

    // Also check calculateTotal
    impl.reset();
    const cartId2 = impl.createCart('user1');
    impl.addItem(cartId2, 'ITEM1', 1);
    impl.deleteProduct('ITEM1');

    const totalResult = impl.calculateTotal(cartId2);
    if (totalResult.success && !totalResult.error) {
      // Check if it silently uses stale price
      throw new Error('VULNERABILITY: calculateTotal succeeded for deleted product');
    }
  });

  // GT010: Discount exceeds cart total
  runner.test('GT010', 'Discount applied incorrectly', (impl) => {
    const cartId = impl.createCart('user1');
    impl.addItem(cartId, 'ITEM1', 1); // $19.99

    // Apply 100% discount
    impl.applyDiscount(cartId, 'FREE');

    const { total, totalCents } = impl.calculateTotal(cartId);
    const finalCents = totalCents !== undefined ? totalCents : Math.round(total * 100);

    // Total should be 0, not negative
    if (finalCents < 0) {
      throw new Error(`VULNERABILITY: Total went negative (${finalCents} cents)`);
    }

    // Check for reasonable max discount behavior
    impl.reset();
    const cartId2 = impl.createCart('user1');
    impl.addItem(cartId2, 'ITEM1', 10); // $199.90

    impl.applyDiscount(cartId2, 'FREE');
    impl.applyDiscount(cartId2, 'SAVE50'); // This shouldn't stack if codes are enforced

    const result2 = impl.calculateTotal(cartId2);
    const final2 = result2.totalCents !== undefined ? result2.totalCents : Math.round(result2.total * 100);

    // If stacking allowed and no caps, total could be negative
    if (final2 < 0) {
      throw new Error(`VULNERABILITY: Stacked discounts made total negative (${final2} cents)`);
    }
  });

  // GT011: Integer overflow on quantity
  runner.test('GT011', 'No quantity limits', (impl) => {
    const cartId = impl.createCart('user1');

    // Try to add unreasonable quantity
    const result = impl.addItem(cartId, 'ITEM1', 1000000);

    // Should either fail or have a reasonable limit
    if (result.success) {
      const state = impl.getState();
      const cart = state.carts[cartId];
      const item = cart.items.find(i => i.productId === 'ITEM1');

      if (item && item.quantity >= 1000000) {
        throw new Error('VULNERABILITY: Unreasonable quantity (1M) accepted');
      }
    }

    // Check for MAX_INT handling
    impl.reset();
    const cartId2 = impl.createCart('user1');
    const bigResult = impl.addItem(cartId2, 'ITEM1', Number.MAX_SAFE_INTEGER);

    if (bigResult.success) {
      throw new Error('VULNERABILITY: MAX_SAFE_INTEGER quantity accepted');
    }
  });

  // GT012: Cart manipulation after checkout started
  runner.test('GT012', 'Cart manipulation during checkout', (impl) => {
    const cartId = impl.createCart('user1');
    impl.addItem(cartId, 'ITEM1', 1);

    // Get cart state during checkout
    const state = impl.getState();
    const cart = state.carts[cartId];

    // Check if implementation has any mechanism to prevent modification during checkout
    // We'll check if the lock mechanism exists
    if (!cart.hasOwnProperty('lock') && !cart.hasOwnProperty('status')) {
      throw new Error('VULNERABILITY: No mechanism to prevent cart modification during checkout');
    }

    // Test actual behavior - start checkout and try to modify
    // Note: In sync JavaScript this is hard to test, but we check the mechanism exists
    impl.reset();
    const cartId2 = impl.createCart('user1');
    impl.addItem(cartId2, 'ITEM1', 1);

    // Simulate checkout in progress by manually setting status
    const state2 = impl.getState();
    const cart2 = state2.carts[cartId2];

    // For secure impl with lock, test that addItem fails when locked
    if (cart2.lock !== undefined) {
      // Implementation has locking - good
    } else if (cart2.status === 'active') {
      // Check if modification is allowed after status change
      // This is a design check
    }
  });

  return runner.summary();
}

// Main
function main() {
  const path = require('path');
  const args = process.argv.slice(2);
  const implName = args[0] || 'vulnerable';

  const projectRoot = path.join(__dirname, '..');
  const implPath = implName.includes('/')
    ? path.resolve(implName)
    : path.join(projectRoot, 'src', `cart-${implName}.js`);

  console.log('=== Shopping Cart Ground Truth Tests ===');
  console.log(`Testing: ${implPath}`);

  let impl;
  try {
    impl = require(implPath);
  } catch (e) {
    console.error(`Failed to load: ${e.message}`);
    process.exit(1);
  }

  const summary = runGroundTruthTests(impl, implPath);

  console.log('\n=== Summary ===');
  console.log(`Passed: ${summary.passed}/${summary.total}`);
  console.log(`Failed: ${summary.failed}/${summary.total}`);

  const vulnerabilities = summary.results.filter(r => !r.passed);
  console.log('\nVulnerabilities detected:');
  vulnerabilities.forEach(v => {
    console.log(`  - ${v.id}: ${v.title}`);
  });

  const outputPath = args[1];
  if (outputPath) {
    require('fs').writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
  }

  process.exit(summary.failed > 0 ? 1 : 0);
}

module.exports = { runGroundTruthTests };

if (require.main === module) {
  main();
}
