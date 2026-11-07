/**
 * Parthu Reddy's Online Cart Management System
 * Homepage & Catalog Controller
 */

let allProducts = [];
let currentCategory = 'All';
let currentMaxPrice = 3000;
let currentSort = 'newest';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  await initGlobalHeader();
  await loadCategories();
  await loadProducts();
  setupEventListeners();
});

function setupEventListeners() {
  // Search input in header
  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        searchQuery = e.target.value;
        loadProducts();
      }, 350);
    });
  }

  // Price slider
  const priceSlider = document.getElementById('priceRange');
  const priceVal = document.getElementById('priceVal');
  if (priceSlider && priceVal) {
    priceSlider.addEventListener('input', (e) => {
      currentMaxPrice = e.target.value;
      priceVal.textContent = `$${currentMaxPrice}`;
    });
    priceSlider.addEventListener('change', () => {
      loadProducts();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      loadProducts();
    });
  }
}

// Load Categories
async function loadCategories() {
  const container = document.getElementById('categoryPills');
  if (!container) return;

  try {
    const res = await API.getCategories();
    if (res.success && res.categories) {
      let html = `<button class="cat-pill ${currentCategory === 'All' ? 'active' : ''}" onclick="selectCategory('All')">All Categories</button>`;
      res.categories.forEach(cat => {
        html += `<button class="cat-pill ${currentCategory === cat ? 'active' : ''}" onclick="selectCategory('${cat}')">${cat}</button>`;
      });
      container.innerHTML = html;
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function selectCategory(category) {
  currentCategory = category;
  // Update active pill
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === (category === 'All' ? 'All Categories' : category));
  });
  loadProducts();
}

// Load and Render Products
async function loadProducts() {
  const grid = document.getElementById('productGrid');
  const countLabel = document.getElementById('productCountLabel');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0;">
      <div style="font-size: 2rem; margin-bottom: 12px; animation: pulse 1s infinite;">⏳</div>
      <p style="color: var(--text-muted); font-size: 0.95rem;">Fetching products from MySQL database...</p>
    </div>
  `;

  try {
    const params = {
      category: currentCategory,
      maxPrice: currentMaxPrice,
      sort: currentSort,
      q: searchQuery
    };

    const res = await API.getProducts(params);
    allProducts = res.products || [];

    if (countLabel) {
      countLabel.textContent = `Showing ${allProducts.length} premium products`;
    }

    if (allProducts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">No products found</h3>
          <p>Try clearing filters or searching for something else.</p>
          <button class="nav-btn nav-btn-primary" style="margin-top: 16px;" onclick="resetFilters()">Reset Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = allProducts.map(p => {
      const stockStatus = p.stock <= 0 
        ? { text: 'Out of Stock', class: 'out-stock' } 
        : p.stock <= 5 
        ? { text: `Only ${p.stock} left`, class: 'low-stock' } 
        : { text: 'In Stock', class: 'in-stock' };

      const imgSrc = p.image_url || getFallbackImage(p.category);

      return `
        <div class="product-card">
          <div class="product-img-wrapper">
            <img src="${imgSrc}" alt="${p.product_name}" class="product-img" onerror="this.src='${getFallbackImage(p.category)}'" />
            <div class="product-badge-group">
              <span class="card-cat-tag">${p.category}</span>
              <span class="card-stock-tag ${stockStatus.class}">${stockStatus.text}</span>
            </div>
          </div>
          <div class="product-info">
            <h4 class="product-name" title="${p.product_name}">${p.product_name}</h4>
            <p class="product-desc">${p.description || 'Premium quality product backed by Parthu Reddy\'s verified authentic guarantee.'}</p>
            <div class="product-price-row">
              <span class="product-price">${formatCurrency(p.price)}</span>
              <span class="product-stock-count">${p.stock} units available</span>
            </div>
            <div class="product-actions">
              <button class="btn-add-cart" onclick="handleAddToCart(${p.product_id})" ${p.stock <= 0 ? 'disabled' : ''}>
                <span>🛒</span>
                <span>${p.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}</span>
              </button>
              <button class="btn-quick-view" onclick="openProductQuickView(${p.product_id})" title="Quick View">
                <span>👁️</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon" style="color: var(--accent-rose);">⚠️</div>
        <h3 class="empty-title">Database Offline or Unreachable</h3>
        <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 16px;">
          ${err.message || 'Unable to connect to MySQL database. Please verify your connection configuration.'}
        </p>
        <button class="nav-btn nav-btn-primary" onclick="openDbGuideModal()">View MySQL Setup Guide</button>
      </div>
    `;
  }
}

function resetFilters() {
  currentCategory = 'All';
  currentMaxPrice = 3000;
  currentSort = 'newest';
  searchQuery = '';
  const searchInput = document.getElementById('globalSearch');
  if (searchInput) searchInput.value = '';
  const priceSlider = document.getElementById('priceRange');
  const priceVal = document.getElementById('priceVal');
  if (priceSlider && priceVal) {
    priceSlider.value = 3000;
    priceVal.textContent = '$3000';
  }
  loadCategories();
  loadProducts();
}

// Add to Cart
async function handleAddToCart(productId, quantity = 1) {
  if (!API.isLoggedIn()) {
    showToast('Please log in to add items to your cart.', 'warning');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1200);
    return;
  }

  try {
    const res = await API.addToCart(productId, quantity);
    showToast(res.message || 'Added to cart!', 'success');
    await updateCartBadge();
    // Auto open cart drawer to give smooth feedback
    openCartDrawer();
  } catch (err) {
    showToast(err.message || 'Failed to add item to cart.', 'error');
  }
}

// Cart Drawer
async function openCartDrawer() {
  const overlay = document.getElementById('cartOverlay');
  const drawer = document.getElementById('cartDrawer');
  if (!overlay || !drawer) return;

  overlay.classList.add('active');
  drawer.classList.add('active');
  await renderCartDrawerItems();
}

function closeCartDrawer() {
  const overlay = document.getElementById('cartOverlay');
  const drawer = document.getElementById('cartDrawer');
  if (overlay && drawer) {
    overlay.classList.remove('active');
    drawer.classList.remove('active');
  }
}

async function renderCartDrawerItems() {
  const container = document.getElementById('cartItemsList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const taxEl = document.getElementById('cartTax');
  const shippingEl = document.getElementById('cartShipping');
  const totalEl = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('btnStartCheckout');

  if (!container) return;

  if (!API.isLoggedIn()) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h4 class="empty-title">You are not logged in</h4>
        <p>Please log in to view and manage your shopping cart.</p>
        <a href="/login.html" class="nav-btn nav-btn-primary" style="margin-top: 14px; display: inline-flex;">Log In Now</a>
      </div>
    `;
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  try {
    const cart = await API.getCart();

    if (!cart.items || cart.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <h4 class="empty-title">Your cart is empty</h4>
          <p>Explore our premium catalog and add your favorite items!</p>
          <button class="nav-btn nav-btn-outline" style="margin-top: 14px;" onclick="closeCartDrawer()">Start Shopping</button>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = formatCurrency(0);
      if (taxEl) taxEl.textContent = formatCurrency(0);
      if (shippingEl) shippingEl.textContent = formatCurrency(0);
      if (totalEl) totalEl.textContent = formatCurrency(0);
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    if (checkoutBtn) checkoutBtn.disabled = false;

    container.innerHTML = cart.items.map(item => `
      <div class="cart-item">
        <img src="${item.image_url || getFallbackImage(item.category)}" alt="${item.product_name}" class="cart-item-img" onerror="this.src='${getFallbackImage(item.category)}'" />
        <div class="cart-item-details">
          <div class="cart-item-title">${item.product_name}</div>
          <div class="cart-item-price">${formatCurrency(item.price)} each</div>
          <div class="qty-control">
            <button class="qty-btn" onclick="updateCartQuantity(${item.cart_id}, ${item.quantity - 1})">-</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartQuantity(${item.cart_id}, ${item.quantity + 1})" ${item.quantity >= item.stock ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div>
          <button class="cart-item-remove" onclick="removeCartItem(${item.cart_id})" title="Remove item">🗑️</button>
        </div>
      </div>
    `).join('');

    if (subtotalEl) subtotalEl.textContent = formatCurrency(cart.subtotal);
    if (taxEl) taxEl.textContent = formatCurrency(cart.tax);
    if (shippingEl) shippingEl.textContent = cart.shipping === 0 ? 'FREE' : formatCurrency(cart.shipping);
    if (totalEl) totalEl.textContent = formatCurrency(cart.total);

  } catch (err) {
    container.innerHTML = `<p style="color: var(--accent-rose); padding: 20px;">Error loading cart: ${err.message}</p>`;
  }
}

async function updateCartQuantity(cartId, newQty) {
  try {
    const res = await API.updateCartItem(cartId, newQty);
    showToast(res.message, 'info');
    await updateCartBadge();
    await renderCartDrawerItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeCartItem(cartId) {
  try {
    const res = await API.removeCartItem(cartId);
    showToast(res.message, 'info');
    await updateCartBadge();
    await renderCartDrawerItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Quick View Modal
function openProductQuickView(productId) {
  const product = allProducts.find(p => p.product_id === productId);
  if (!product) return;

  let modal = document.getElementById('quickViewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quickViewModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const stockBadge = product.stock <= 0 
    ? '<span class="status-badge badge-cancelled">Out of Stock</span>' 
    : product.stock <= 5 
    ? `<span class="status-badge badge-pending">Low Stock (${product.stock} remaining)</span>` 
    : `<span class="status-badge badge-delivered">In Stock (${product.stock} available)</span>`;

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 680px;">
      <div class="modal-header">
        <h3 class="modal-title">Product Details</h3>
        <button class="close-btn" onclick="closeQuickViewModal()">×</button>
      </div>
      <div class="modal-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <div>
            <img src="${product.image_url || getFallbackImage(product.category)}" 
                 alt="${product.product_name}" 
                 style="width: 100%; height: 260px; object-fit: cover; border-radius: 12px; box-shadow: var(--shadow-sm);" 
                 onerror="this.src='${getFallbackImage(product.category)}'" />
          </div>
          <div>
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--blue-600); text-transform: uppercase; margin-bottom: 4px;">
              ${product.category}
            </div>
            <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--navy-900); margin-bottom: 8px;">
              ${product.product_name}
            </h3>
            <div style="margin-bottom: 14px;">${stockBadge}</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: var(--navy-900); margin-bottom: 14px;">
              ${formatCurrency(product.price)}
            </div>
            <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">
              ${product.description || 'Premium craftsmanship with rigorous quality testing, backed by the Parthu Reddy customer satisfaction guarantee.'}
            </p>
            <div style="display: flex; gap: 12px; align-items: center;">
              <input type="number" id="quickViewQty" value="1" min="1" max="${product.stock}" 
                     style="width: 70px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-light); text-align: center; font-weight: 700;" 
                     ${product.stock <= 0 ? 'disabled' : ''} />
              <button class="nav-btn nav-btn-primary" style="flex: 1; padding: 12px;" 
                      onclick="handleQuickViewAddToCart(${product.product_id})" ${product.stock <= 0 ? 'disabled' : ''}>
                🛒 Add To Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeQuickViewModal() {
  const modal = document.getElementById('quickViewModal');
  if (modal) modal.classList.remove('active');
}

async function handleQuickViewAddToCart(productId) {
  const qtyInput = document.getElementById('quickViewQty');
  const qty = qtyInput ? parseInt(qtyInput.value, 10) : 1;
  closeQuickViewModal();
  await handleAddToCart(productId, qty);
}

// Checkout Flow
function openCheckoutModal() {
  closeCartDrawer();

  let modal = document.getElementById('checkoutModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'checkoutModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const user = API.getUser() || {};

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 520px;">
      <div class="modal-header">
        <h3 class="modal-title">📦 Checkout Order</h3>
        <button class="close-btn" onclick="closeCheckoutModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 16px;">
          Confirm your delivery details. Your order will be processed securely using server-calculated prices from MySQL.
        </p>
        <div class="form-group">
          <label class="form-label">Customer Name</label>
          <input type="text" class="form-control" value="${user.name || ''}" readonly style="background: #f1f5f9;" />
        </div>
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" class="form-control" value="${user.email || ''}" readonly style="background: #f1f5f9;" />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Shipping Address *</label>
          <textarea id="checkoutAddress" class="form-control" rows="3" placeholder="Enter full delivery street address, city, state, and zip code..." required></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select class="form-control" id="checkoutPaymentMethod">
            <option value="card">Credit / Debit Card (Simulated Secure Gateway)</option>
            <option value="upi">UPI / Instant Bank Transfer</option>
            <option value="cod">Cash on Delivery</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="nav-btn nav-btn-outline" onclick="closeCheckoutModal()">Cancel</button>
        <button class="nav-btn nav-btn-primary" id="btnPlaceOrder" onclick="submitCheckout()">
          ✅ Confirm & Place Order
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.remove('active');
}

async function submitCheckout() {
  const addressInput = document.getElementById('checkoutAddress');
  const address = addressInput ? addressInput.value.trim() : '';

  if (!address) {
    showToast('Please provide a delivery address.', 'warning');
    if (addressInput) addressInput.focus();
    return;
  }

  const btn = document.getElementById('btnPlaceOrder');
  btn.disabled = true;
  btn.textContent = 'Processing Transaction...';

  try {
    const res = await API.checkout(address);
    closeCheckoutModal();
    await updateCartBadge();

    // Show Success Modal
    openOrderSuccessModal(res);
  } catch (err) {
    showToast(err.message || 'Failed to place order.', 'error');
    btn.disabled = false;
    btn.textContent = '✅ Confirm & Place Order';
  }
}

function openOrderSuccessModal(orderData) {
  let modal = document.getElementById('orderSuccessModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'orderSuccessModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-box" style="text-align: center; padding: 32px 24px; max-width: 480px;">
      <div style="font-size: 3.5rem; margin-bottom: 16px;">🎉</div>
      <h3 style="font-size: 1.5rem; font-weight: 800; color: var(--navy-900); margin-bottom: 8px;">Order Placed Successfully!</h3>
      <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 20px;">
        Thank you for shopping at <strong>Parthu Reddy's Online Cart</strong>! Your order has been recorded in MySQL with transaction consistency.
      </p>
      <div style="background: var(--bg-page); border: 1px solid var(--border-light); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
          <span style="color: var(--text-muted);">Order ID:</span>
          <strong>#${orderData.orderId}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
          <span style="color: var(--text-muted);">Total Amount:</span>
          <strong style="color: var(--blue-600);">${formatCurrency(orderData.totalAmount)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
          <span style="color: var(--text-muted);">Status:</span>
          <span class="status-badge badge-pending">${orderData.status || 'Pending'}</span>
        </div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <a href="/customer-dashboard.html" class="nav-btn nav-btn-primary">View My Orders</a>
        <button class="nav-btn nav-btn-outline" onclick="closeSuccessModalAndRefresh()">Continue Shopping</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeSuccessModalAndRefresh() {
  const modal = document.getElementById('orderSuccessModal');
  if (modal) modal.classList.remove('active');
  loadProducts();
}
