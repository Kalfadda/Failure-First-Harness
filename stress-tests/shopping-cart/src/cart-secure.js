/**
 * SECURE Shopping Cart Implementation
 *
 * Addresses all ground truth failures:
 * - GT001: Quantity validation (positive integers only)
 * - GT002: Prices fetched at checkout (not cached)
 * - GT003: Discount codes tracked, single use
 * - GT004: Cart locking during checkout
 * - GT005: Inventory reservation system
 * - GT006: Integer cents arithmetic (no floats)
 * - GT007: Session handling (not applicable in this context)
 * - GT008: Transaction handling with rollback
 * - GT009: Product existence check at checkout
 * - GT010: Discount applied per-item with limits
 * - GT011: Quantity limits enforced
 * - GT012: Cart frozen during checkout
 */

// Simulated database
const products = new Map();
const inventory = new Map();
const reservations = new Map(); // productId -> Map<cartId, qty>
const carts = new Map();
const orders = new Map();
const usedDiscounts = new Map(); // cartId -> Set<code>

// Configuration
const MAX_QUANTITY_PER_ITEM = 100;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

// Initialize test data - prices in CENTS to avoid float issues
function initTestData() {
  products.set('ITEM1', { id: 'ITEM1', name: 'Widget', priceCents: 1999 });
  products.set('ITEM2', { id: 'ITEM2', name: 'Gadget', priceCents: 2999 });
  products.set('ITEM3', { id: 'ITEM3', name: 'Gizmo', priceCents: 10 }); // 10 cents

  inventory.set('ITEM1', 10);
  inventory.set('ITEM2', 5);
  inventory.set('ITEM3', 100);

  reservations.set('ITEM1', new Map());
  reservations.set('ITEM2', new Map());
  reservations.set('ITEM3', new Map());
}

initTestData();

function getAvailableInventory(productId, excludeCartId = null) {
  const total = inventory.get(productId) || 0;
  const productReservations = reservations.get(productId) || new Map();

  let reserved = 0;
  for (const [cartId, qty] of productReservations) {
    if (cartId !== excludeCartId) {
      reserved += qty;
    }
  }

  return total - reserved;
}

function createCart(userId) {
  const cartId = `cart_${userId}_${Date.now()}`;
  carts.set(cartId, {
    id: cartId,
    userId,
    items: [],
    discounts: [],
    status: 'active',
    lock: null
  });
  usedDiscounts.set(cartId, new Set());
  return cartId;
}

function addItem(cartId, productId, quantity) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT012: Check if cart is locked
  if (cart.lock) {
    return { success: false, error: 'Cart is locked during checkout' };
  }

  const product = products.get(productId);
  if (!product) return { success: false, error: 'Product not found' };

  // GT001: Validate quantity is positive integer
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, error: 'Quantity must be a positive integer' };
  }

  // GT011: Check quantity limits
  const existingItem = cart.items.find(i => i.productId === productId);
  const currentQty = existingItem ? existingItem.quantity : 0;
  const newTotalQty = currentQty + quantity;

  if (newTotalQty > MAX_QUANTITY_PER_ITEM) {
    return { success: false, error: `Maximum quantity per item is ${MAX_QUANTITY_PER_ITEM}` };
  }

  // Check for integer overflow
  if (newTotalQty > MAX_SAFE_INTEGER) {
    return { success: false, error: 'Quantity too large' };
  }

  // GT005: Check and reserve inventory
  const available = getAvailableInventory(productId, cartId);
  if (newTotalQty > available) {
    return { success: false, error: 'Insufficient inventory' };
  }

  // Update cart
  if (existingItem) {
    existingItem.quantity = newTotalQty;
  } else {
    cart.items.push({
      productId,
      quantity
      // GT002: No price caching - will fetch at checkout
    });
  }

  // GT005: Update reservation
  const productReservations = reservations.get(productId);
  productReservations.set(cartId, newTotalQty);

  return { success: true, cart };
}

function updateQuantity(cartId, productId, quantity) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT012: Check if cart is locked
  if (cart.lock) {
    return { success: false, error: 'Cart is locked during checkout' };
  }

  const item = cart.items.find(i => i.productId === productId);
  if (!item) return { success: false, error: 'Item not in cart' };

  // GT001: Validate quantity
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { success: false, error: 'Quantity must be a non-negative integer' };
  }

  // GT011: Check quantity limits
  if (quantity > MAX_QUANTITY_PER_ITEM) {
    return { success: false, error: `Maximum quantity per item is ${MAX_QUANTITY_PER_ITEM}` };
  }

  // Remove item if quantity is 0
  if (quantity === 0) {
    cart.items = cart.items.filter(i => i.productId !== productId);
    const productReservations = reservations.get(productId);
    if (productReservations) {
      productReservations.delete(cartId);
    }
    return { success: true, cart };
  }

  // GT005: Check inventory for increased quantity
  if (quantity > item.quantity) {
    const available = getAvailableInventory(productId, cartId);
    if (quantity > available) {
      return { success: false, error: 'Insufficient inventory' };
    }
  }

  item.quantity = quantity;

  // Update reservation
  const productReservations = reservations.get(productId);
  productReservations.set(cartId, quantity);

  return { success: true, cart };
}

function applyDiscount(cartId, code) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT012: Check if cart is locked
  if (cart.lock) {
    return { success: false, error: 'Cart is locked during checkout' };
  }

  // GT003: Check if discount already applied
  const cartDiscounts = usedDiscounts.get(cartId);
  if (cartDiscounts.has(code)) {
    return { success: false, error: 'Discount code already applied' };
  }

  const discounts = {
    'SAVE10': { type: 'percent', value: 10 },
    'SAVE50': { type: 'percent', value: 50 },
    'FREE': { type: 'percent', value: 100 }
  };

  const discount = discounts[code];
  if (!discount) return { success: false, error: 'Invalid code' };

  // GT010: Discount has max limit and applies correctly
  cart.discounts.push({ code, ...discount, maxDiscountCents: 10000 }); // Max $100 discount
  cartDiscounts.add(code);

  return { success: true, cart };
}

function calculateTotal(cartId) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT006: Use integer cents arithmetic
  let totalCents = 0;

  for (const item of cart.items) {
    // GT002 & GT009: Fetch current price, check product exists
    const product = products.get(item.productId);
    if (!product) {
      return { success: false, error: `Product ${item.productId} no longer exists` };
    }

    // GT006: Integer multiplication
    const itemTotal = product.priceCents * item.quantity;

    // Check for overflow
    if (itemTotal > MAX_SAFE_INTEGER || totalCents + itemTotal > MAX_SAFE_INTEGER) {
      return { success: false, error: 'Total overflow' };
    }

    totalCents += itemTotal;
  }

  // Apply discounts
  let totalDiscountCents = 0;
  for (const discount of cart.discounts) {
    if (discount.type === 'percent') {
      let discountAmount = Math.floor(totalCents * discount.value / 100);

      // GT010: Apply max discount limit
      if (discount.maxDiscountCents) {
        discountAmount = Math.min(discountAmount, discount.maxDiscountCents);
      }

      totalDiscountCents += discountAmount;
    }
  }

  // GT010: Ensure discount doesn't exceed total
  totalDiscountCents = Math.min(totalDiscountCents, totalCents);
  const finalCents = totalCents - totalDiscountCents;

  return {
    success: true,
    totalCents: finalCents,
    total: finalCents / 100 // For display
  };
}

function acquireLock(cartId) {
  const cart = carts.get(cartId);
  if (!cart) return false;

  if (cart.lock) {
    return false; // Already locked
  }

  cart.lock = Date.now();
  return true;
}

function releaseLock(cartId) {
  const cart = carts.get(cartId);
  if (cart) {
    cart.lock = null;
  }
}

function checkout(cartId, paymentInfo) {
  const cart = carts.get(cartId);
  if (!cart) return { success: false, error: 'Cart not found' };

  // GT004 & GT012: Acquire exclusive lock
  if (!acquireLock(cartId)) {
    return { success: false, error: 'Checkout already in progress' };
  }

  try {
    if (cart.status !== 'active') {
      return { success: false, error: 'Cart not active' };
    }

    if (cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    // GT009: Verify all products still exist and have inventory
    for (const item of cart.items) {
      const product = products.get(item.productId);
      if (!product) {
        return { success: false, error: `Product ${item.productId} no longer exists` };
      }

      const available = inventory.get(item.productId) || 0;
      if (available < item.quantity) {
        return { success: false, error: `Insufficient inventory for ${item.productId}` };
      }
    }

    const { success: calcSuccess, totalCents, error: calcError } = calculateTotal(cartId);
    if (!calcSuccess) {
      return { success: false, error: calcError };
    }

    // GT008: Transaction - mark as processing
    cart.status = 'processing';

    // Simulate payment
    const paymentSuccess = processPayment(paymentInfo, totalCents);

    if (!paymentSuccess) {
      // GT008: Rollback on failure
      cart.status = 'active';
      return { success: false, error: 'Payment failed' };
    }

    // GT005: Deduct from actual inventory (atomically)
    for (const item of cart.items) {
      const current = inventory.get(item.productId) || 0;
      inventory.set(item.productId, current - item.quantity);

      // Clear reservation
      const productReservations = reservations.get(item.productId);
      if (productReservations) {
        productReservations.delete(cartId);
      }
    }

    // Create order
    const orderId = `order_${Date.now()}`;
    orders.set(orderId, {
      id: orderId,
      cartId,
      totalCents,
      total: totalCents / 100,
      status: 'completed'
    });

    cart.status = 'completed';

    return { success: true, orderId, total: totalCents / 100 };
  } finally {
    // Always release lock
    releaseLock(cartId);
  }
}

function processPayment(info, amountCents) {
  // Simulate payment - always succeeds unless amount is invalid
  return amountCents >= 0 && amountCents <= MAX_SAFE_INTEGER;
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
  reservations.clear();
  carts.clear();
  orders.clear();
  usedDiscounts.clear();
  initTestData();
}

function updateProductPrice(productId, newPriceCents) {
  const product = products.get(productId);
  if (product) {
    product.priceCents = newPriceCents;
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
