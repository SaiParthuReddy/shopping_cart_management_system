/**
 * Parthu Reddy's Online Cart Management System
 * API Client & Core Frontend Utilities
 */

const API = {
  baseUrl: '',

  // Auth Storage
  getToken() {
    return localStorage.getItem('parthu_cart_token');
  },
  setToken(token) {
    localStorage.setItem('parthu_cart_token', token);
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('parthu_cart_user'));
    } catch (e) {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('parthu_cart_user', JSON.stringify(user));
  },
  clearAuth() {
    localStorage.removeItem('parthu_cart_token');
    localStorage.removeItem('parthu_cart_user');
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  // Centralized Fetch
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If 401 Unauthorized or 403 Invalid token, clear expired auth
        if (response.status === 401 && token) {
          this.clearAuth();
          if (window.location.pathname !== '/login.html' && window.location.pathname !== '/login') {
            window.location.reload();
          }
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${endpoint}]:`, err.message);
      throw err;
    }
  },

  // Auth Endpoints
  async register(name, email, password, phone) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone }),
    });
    if (res.token) {
      this.setToken(res.token);
      this.setUser(res.user);
    }
    return res;
  },

  async login(email, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      this.setToken(res.token);
      this.setUser(res.user);
    }
    return res;
  },

  async getMe() {
    return await this.request('/api/auth/me');
  },

  logout() {
    this.clearAuth();
    window.location.href = '/login.html';
  },

  // Product Endpoints
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/api/products${query ? '?' + query : ''}`);
  },

  async getProduct(id) {
    return await this.request(`/api/products/${id}`);
  },

  async getCategories() {
    return await this.request('/api/products/categories');
  },

  // Cart Endpoints
  async getCart() {
    return await this.request('/api/cart');
  },

  async addToCart(productId, quantity = 1) {
    return await this.request('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity }),
    });
  },

  async updateCartItem(cartId, quantity) {
    return await this.request(`/api/cart/${cartId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  },

  async removeCartItem(cartId) {
    return await this.request(`/api/cart/${cartId}`, {
      method: 'DELETE',
    });
  },

  async clearCart() {
    return await this.request('/api/cart', {
      method: 'DELETE',
    });
  },

  // Order Endpoints
  async checkout(shippingAddress) {
    return await this.request('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({ shipping_address: shippingAddress }),
    });
  },

  async getOrders() {
    return await this.request('/api/orders');
  },

  async getOrder(orderId) {
    return await this.request(`/api/orders/${orderId}`);
  },

  async cancelOrder(orderId) {
    return await this.request(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
    });
  },

  // Admin Endpoints
  async getAdminDashboard() {
    return await this.request('/api/admin/dashboard');
  },

  async getAdminProducts() {
    return await this.request('/api/admin/products');
  },

  async createProduct(productData) {
    return await this.request('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  async updateProduct(id, productData) {
    return await this.request(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  async updateProductStock(id, stock) {
    return await this.request(`/api/admin/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock }),
    });
  },

  async deleteProduct(id) {
    return await this.request(`/api/admin/products/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminOrders(status = 'All') {
    return await this.request(`/api/admin/orders${status !== 'All' ? '?status=' + status : ''}`);
  },

  async updateOrderStatus(orderId, status) {
    return await this.request(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async getAdminCustomers() {
    return await this.request('/api/admin/customers');
  },

  // DB Health & Status
  async getDbStatus() {
    return await this.request('/api/db-status');
  },

  async retryDb() {
    return await this.request('/api/db-retry', { method: 'POST' });
  }
};

// UI Helpers: Toast Notification
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.1rem;">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Currency Formatter
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
}

// Fallback image generator based on category
function getFallbackImage(category) {
  const images = {
    Audio: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    Laptops: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
    Accessories: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80',
    Smartphones: 'https://images.unsplash.com/photo-1511707171634-5f897ff025a5?w=600&auto=format&fit=crop&q=80',
    Wearables: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    Monitors: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
    Gaming: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80',
    Storage: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80'
  };
  return images[category] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';
}

// Setup common header database status check and user state
async function initGlobalHeader() {
  const bar = document.getElementById('dbStatusBar');
  if (bar) {
    try {
      const status = await API.getDbStatus();
      if (status.connected) {
        bar.innerHTML = `
          <div class="db-status-badge">
            <span class="status-dot connected"></span>
            <span>MySQL: <strong>Connected</strong> (${status.database}@${status.host}:${status.port})</span>
          </div>
          <span style="color: #94a3b8; font-size: 0.75rem;">Real-time database sync active</span>
        `;
      } else {
        bar.innerHTML = `
          <div class="db-status-badge">
            <span class="status-dot disconnected"></span>
            <span>MySQL: <strong>Disconnected</strong> (${status.error || 'Server offline'})</span>
          </div>
          <div>
            <button class="db-quick-guide-btn" onclick="openDbGuideModal()">Setup / Retry MySQL</button>
          </div>
        `;
      }
    } catch (e) {
      bar.innerHTML = `
        <div class="db-status-badge">
          <span class="status-dot disconnected"></span>
          <span>MySQL Server Check Failed</span>
        </div>
      `;
    }
  }

  // Update Auth in Nav
  const userActions = document.getElementById('navUserActions');
  if (userActions) {
    const user = API.getUser();
    if (user) {
      userActions.innerHTML = `
        <div class="user-menu-wrapper">
          <button class="nav-btn nav-btn-outline" onclick="toggleUserDropdown(event)">
            <span>👤 ${user.name.split(' ')[0]}</span>
            <span style="font-size: 0.7rem;">▼</span>
          </button>
          <div class="user-menu-dropdown" id="userMenuDropdown">
            <div class="user-menu-header">
              <div class="name">${user.name}</div>
              <div class="email">${user.email}</div>
              <div style="font-size: 0.7rem; color: #60a5fa; text-transform: uppercase; margin-top: 2px;">${user.role}</div>
            </div>
            ${user.role === 'admin' ? `
              <a href="/admin.html" class="user-menu-item">
                <span>⚙️</span> Admin Dashboard
              </a>
            ` : ''}
            <a href="/customer-dashboard.html" class="user-menu-item">
              <span>📦</span> My Orders & Profile
            </a>
            <div class="user-menu-divider"></div>
            <div class="user-menu-item" onclick="API.logout()" style="color: var(--accent-rose);">
              <span>🚪</span> Sign Out
            </div>
          </div>
        </div>
      `;
    } else {
      userActions.innerHTML = `
        <a href="/login.html" class="nav-btn nav-btn-outline">Log In</a>
        <a href="/login.html?tab=register" class="nav-btn nav-btn-primary">Register</a>
      `;
    }
  }

  // Update Cart badge if logged in
  updateCartBadge();
}

function toggleUserDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('userMenuDropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

window.addEventListener('click', () => {
  const dropdown = document.getElementById('userMenuDropdown');
  if (dropdown) dropdown.classList.remove('show');
});

async function updateCartBadge() {
  const badge = document.getElementById('navCartCount');
  if (!badge) return;
  if (!API.isLoggedIn()) {
    badge.textContent = '0';
    return;
  }
  try {
    const cart = await API.getCart();
    badge.textContent = cart.itemCount || 0;
  } catch (err) {
    badge.textContent = '0';
  }
}

// Modal for MySQL Guide
function openDbGuideModal() {
  let modal = document.getElementById('dbGuideModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dbGuideModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">🐬 MySQL Database Setup Guide</h3>
          <button class="close-btn" onclick="closeDbGuideModal()">×</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 12px; font-size: 0.9rem; color: var(--text-secondary);">
            Parthu Reddy's Online Cart requires a live MySQL server. If MySQL is not connected, follow these simple steps:
          </p>
          <ol style="padding-left: 20px; font-size: 0.875rem; line-height: 1.8; color: var(--text-primary); margin-bottom: 16px;">
            <li><strong>Start MySQL Server</strong>: Ensure MySQL 8.0, XAMPP, WAMP, or Laragon is running on port 3306.</li>
            <li><strong>Configure .env</strong>: Check your <code>.env</code> file in the project folder with your credentials:
              <pre style="background: #0b192c; color: #93c5fd; padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 0.8rem;">
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=parthu_cart_db
DB_PORT=3306</pre>
            </li>
            <li><strong>Auto-Initialize Tables</strong>: Run <code>npm run init-db</code> in the terminal to initialize tables & sample seed data.</li>
          </ol>
          <div id="dbRetryFeedback" style="display: none; padding: 10px; border-radius: 6px; font-size: 0.85rem; margin-top: 10px;"></div>
        </div>
        <div class="modal-footer">
          <button class="nav-btn nav-btn-outline" onclick="closeDbGuideModal()">Close</button>
          <button class="nav-btn nav-btn-primary" id="btnRetryDb" onclick="handleDbRetry()">Retry Connection</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.classList.add('active');
}

function closeDbGuideModal() {
  const modal = document.getElementById('dbGuideModal');
  if (modal) modal.classList.remove('active');
}

async function handleDbRetry() {
  const btn = document.getElementById('btnRetryDb');
  const feedback = document.getElementById('dbRetryFeedback');
  btn.disabled = true;
  btn.textContent = 'Connecting...';
  try {
    const res = await API.retryDb();
    feedback.style.display = 'block';
    if (res.connected) {
      feedback.style.background = '#d1fae5';
      feedback.style.color = '#065f46';
      feedback.textContent = '✅ ' + res.message;
      showToast('MySQL connected successfully!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      feedback.style.background = '#fee2e2';
      feedback.style.color = '#991b1b';
      feedback.textContent = '❌ ' + (res.error || 'Connection failed.');
    }
  } catch (err) {
    feedback.style.display = 'block';
    feedback.style.background = '#fee2e2';
    feedback.style.color = '#991b1b';
    feedback.textContent = '❌ ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Retry Connection';
  }
}
