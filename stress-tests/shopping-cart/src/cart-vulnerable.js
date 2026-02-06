/**
 * VULNERABLE Shopping Cart Implementation
 *
 * Vulnerabilities:
 * - GT001: Negative quantities allowed
 * - GT002: Prices cached at add time
 * - GT003: Discount codes can be reapplied
 * - GT004: No checkout locking
 * - GT005: No inventory reservation
 * - GT006: Float arithmetic
 * - GT008: No transaction handling
 * - GT009: No product existence check at checkout
 * - GT010: Discount applied to total, not item
 * - GT011: No quantity limits
 * - GT012: No cart locking during checkout
 */

// Simulated database
const products = new Map();
const inventory = new Map();
const carts = new Map();
const orders = new Map();

// Initialize test data
function initTestData() {
  products.set('ITEM1', { id: 'ITEM1', name: 'Widget', price: 19.99 });
  products.set('ITEM2', { id: 'ITEM2', name: 'Gadget', price: 29.99 });
  products.set('ITEM3', { id: 'ITEM3', name: 'Gizmo', price: 0.10 }); // For float test

  inventory.set('ITEM1', 10);
  inventory.set('ITEM2', 5);
  inventory.set('ITEM3', 100);
}

initTestData();

function createCart(userId) {
  const cartId = `cart_${userId}_${Date.now()}`;
  carts.set(cartId, {
    id: cartId,
    userId,
    items: [],
    discounts: [],
    status: 'active'
  });
  return cartId;
}

function addItem(cartId, productId, quantity) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  const product = products.get(productId);
  if (!product) return { success: false, error: 'Product not found' };

  // GT001: No validation on quantity - negative allowed!
  // GT011: No max quantity check

  // GT002: Cache price at add time (won't update if price changes)
  const existingItem = cart.items.find(i => i.productId === productId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      productId,
      quantity,
      priceAtAdd: product.price // Cached price!
    });
  }

  // GT005: No inventory check or reservation

  return { success: true, cart };
}

function updateQuantity(cartId, productId, quantity) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  const item = cart.items.find(i => i.productId === productId);
  if (!item) return { success: false, error: 'Item not in cart' };

  // GT001: Negative quantity allowed!
  item.quantity = quantity;

  return { success: true, cart };
}

function applyDiscount(cartId, code) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT003: No check if discount already applied!
  const discounts = {
    'SAVE10': { type: 'percent', value: 10 },
    'SAVE50': { type: 'percent', value: 50 },
    'FREE': { type: 'percent', value: 100 }
  };

  const discount = discounts[code];
  if (!discount) return { success: false, error: 'Invalid code' };

  // GT010: Discount applied to entire cart total
  cart.discounts.push({ code, ...discount });

  return { success: true, cart };
}

function calculateTotal(cartId) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT006: Using float arithmetic
  let total = 0;
  for (const item of cart.items) {
    total += item.priceAtAdd * item.quantity; // Float multiplication
  }

  // Apply discounts
  for (const discount of cart.discounts) {
    if (discount.type === 'percent') {
      total = total * (1 - discount.value / 100);
    }
  }

  return { success: true, total };
}

function checkout(cartId, paymentInfo) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT004: No locking - concurrent checkouts possible
  // GT012: Cart can be modified during this

  if (cart.status !== 'active') {
    return { success: false, error: 'Cart not active' };
  }

  // GT009: No check if products still exist

  const { total } = calculateTotal(cartId);

  // GT008: Mark as processing before payment
  cart.status = 'processing';

  // Simulate payment
  const paymentSuccess = processPayment(paymentInfo, total);

  if (!paymentSuccess) {
    // GT008: Status left as 'processing' on failure!
    return { success: false, error: 'Payment failed' };
  }

  // GT005: Deduct inventory without checking
  for (const item of cart.items) {
    const current = inventory.get(item.productId) || 0;
    inventory.set(item.productId, current - item.quantity);
  }

  // Create order
  const orderId = `order_${Date.now()}`;
  orders.set(orderId, {
    id: orderId,
    cartId,
    total,
    status: 'completed'
  });

  cart.status = 'completed';

  return { success: true, orderId, total };
}

function processPayment(info, amount) {
  // Simulate payment - always succeeds unless amount negative
  return amount >= 0;
}

// For testing
function getState() {
  return {
    products: Object.fromEntries(products),
    inventory: Object.fromEntries(inventory),
    carts: Object.fromEntries(carts),
    orders: Object.fromEntries(orders)
  };
}

function reset() {
  products.clear();
  inventory.clear();
  carts.clear();
  orders.clear();
  initTestData();
}

function updateProductPrice(productId, newPrice) {
  const product = products.get(productId);
  if (product) {
    product.price = newPrice;
  }
}

function deleteProduct(productId) {
  products.delete(productId);
}

module.exports = {
  createCart,
  addItem,
  updateQuantity,
  applyDiscount,
  calculateTotal,
  checkout,
  getState,
  reset,
  updateProductPrice,
  deleteProduct
};
