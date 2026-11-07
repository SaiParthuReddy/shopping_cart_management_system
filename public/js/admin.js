/**
 * Parthu Reddy's Online Cart Management System
 * Admin Dashboard Controller
 */

let allAdminProducts = [];
let allAdminOrders = [];
let allAdminCustomers = [];
let productPendingDeleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initGlobalHeader();

  // Enforce Admin Role
  if (!API.isLoggedIn()) {
    showToast('Administrator login required.', 'error');
    window.location.href = '/login.html';
    return;
  }
  if (!API.isAdmin()) {
    showToast('Access denied: You do not have administrator permissions.', 'error');
    window.location.href = '/customer-dashboard.html';
    return;
  }

  await refreshAdminData();
});

async function refreshAdminData() {
  await Promise.all([
    loadAdminStats(),
    loadAdminProducts(),
    loadAdminOrders('All'),
    loadAdminCustomers()
  ]);
}

// 1. Stats and Low Stock Alert
async function loadAdminStats() {
  try {
    const res = await API.getAdminDashboard();
    const stats = res.stats || {};

    document.getElementById('adminTotalProducts').textContent = stats.totalProducts || 0;
    document.getElementById('adminTotalCustomers').textContent = stats.totalCustomers || 0;
    document.getElementById('adminTotalOrders').textContent = stats.totalOrders || 0;
    document.getElementById('adminTotalRevenue').textContent = formatCurrency(stats.totalRevenue || 0);

    // Low stock alert banner
    const alertSection = document.getElementById('lowStockAlertSection');
    const badge = document.getElementById('lowStockCountBadge');
    const list = document.getElementById('lowStockList');

    if (res.lowStockProducts && res.lowStockProducts.length > 0) {
      alertSection.style.display = 'block';
      badge.textContent = `${res.lowStockProducts.length} Items`;
      list.innerHTML = res.lowStockProducts.map(p => `
        <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 12px; font-size: 0.825rem; display: flex; align-items: center; gap: 8px;">
          <strong>${p.product_name}</strong>
          <span style="color: var(--accent-rose); font-weight: 700;">(Stock: ${p.stock})</span>
          <button class="nav-btn nav-btn-outline" style="font-size: 0.7rem; padding: 2px 6px;" onclick="promptStockUpdate(${p.product_id}, ${p.stock})">Restock</button>
        </div>
      `).join('');
    } else {
      alertSection.style.display = 'none';
    }

  } catch (err) {
    console.error('Error fetching admin metrics:', err);
  }
}

// Tab Switching
function switchAdminTab(tabName) {
  const tabs = ['products', 'orders', 'customers'];
  tabs.forEach(t => {
    const content = document.getElementById(`tabContent${capitalize(t)}`);
    const btn = document.getElementById(`tabBtn${capitalize(t)}`);
    if (content && btn) {
      if (t === tabName) {
        content.classList.add('active');
        btn.classList.add('active');
      } else {
        content.classList.remove('active');
        btn.classList.remove('active');
      }
    }
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// 2. Products Tab
async function loadAdminProducts() {
  const table = document.getElementById('adminProductsTable');
  const countBadge = document.getElementById('tabCountProducts');
  if (!table) return;

  try {
    const res = await API.getAdminProducts();
    allAdminProducts = res.products || [];
    if (countBadge) countBadge.textContent = allAdminProducts.length;

    renderAdminProducts(allAdminProducts);
  } catch (err) {
    table.innerHTML = `<tr><td colspan="7" style="color: var(--accent-rose); text-align: center; padding: 30px;">Error loading products: ${err.message}</td></tr>`;
  }
}

function renderAdminProducts(products) {
  const table = document.getElementById('adminProductsTable');
  if (!table) return;

  if (products.length === 0) {
    table.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No products match your search.</td></tr>`;
    return;
  }

  table.innerHTML = products.map(p => {
    const stockBadge = p.stock <= 0 
      ? '<span class="status-badge badge-cancelled">Out of Stock (0)</span>' 
      : p.stock <= 5 
      ? `<span class="status-badge badge-pending">Low (${p.stock})</span>` 
      : `<span class="status-badge badge-delivered">Healthy (${p.stock})</span>`;

    const imgSrc = p.image_url || getFallbackImage(p.category);

    return `
      <tr>
        <td>
          <img src="${imgSrc}" alt="${p.product_name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; background: #f1f5f9;" onerror="this.src='${getFallbackImage(p.category)}'" />
        </td>
        <td style="font-weight: 700; color: var(--navy-900); max-width: 250px;">
          <div>${p.product_name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">ID: #${p.product_id}</div>
        </td>
        <td><span class="card-cat-tag" style="background: var(--navy-800);">${p.category}</span></td>
        <td style="font-weight: 800; color: var(--blue-600);">${formatCurrency(p.price)}</td>
        <td>${stockBadge}</td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="number" id="quickStock_${p.product_id}" value="${p.stock}" min="0" 
                   style="width: 60px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-light); font-weight: 600;" />
            <button class="nav-btn nav-btn-outline" style="font-size: 0.72rem; padding: 5px 8px;" onclick="saveQuickStock(${p.product_id})">Set</button>
          </div>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 8px;">
            <button class="nav-btn nav-btn-outline" style="font-size: 0.75rem; padding: 6px 10px;" onclick="openEditProductModal(${p.product_id})">
              ✏️ Edit
            </button>
            <button class="nav-btn nav-btn-outline" style="font-size: 0.75rem; padding: 6px 10px; color: var(--accent-rose); border-color: #fecaca;" onclick="openDeleteModal(${p.product_id}, '${escapeHtml(p.product_name)}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAdminProducts(keyword) {
  if (!keyword || !keyword.trim()) {
    renderAdminProducts(allAdminProducts);
    return;
  }
  const term = keyword.toLowerCase().trim();
  const filtered = allAdminProducts.filter(p => 
    p.product_name.toLowerCase().includes(term) || 
    p.category.toLowerCase().includes(term)
  );
  renderAdminProducts(filtered);
}

// Quick Stock update
async function saveQuickStock(productId) {
  const input = document.getElementById(`quickStock_${productId}`);
  if (!input) return;
  const newStock = parseInt(input.value, 10);
  if (isNaN(newStock) || newStock < 0) {
    showToast('Invalid stock number.', 'warning');
    return;
  }

  try {
    const res = await API.updateProductStock(productId, newStock);
    showToast(res.message, 'success');
    await loadAdminStats();
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function promptStockUpdate(productId, currentStock) {
  const updated = prompt('Enter new stock quantity for this product:', currentStock);
  if (updated !== null) {
    const qty = parseInt(updated, 10);
    if (!isNaN(qty) && qty >= 0) {
      API.updateProductStock(productId, qty).then(() => {
        showToast('Stock updated successfully.', 'success');
        refreshAdminData();
      }).catch(err => showToast(err.message, 'error'));
    }
  }
}

// Product Form Modal (Add & Edit)
function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'Add New Product to MySQL';
  document.getElementById('formProductId').value = '';
  document.getElementById('productForm').reset();
  document.getElementById('productFormModal').classList.add('active');
}

function openEditProductModal(productId) {
  const p = allAdminProducts.find(item => item.product_id === productId);
  if (!p) return;

  document.getElementById('productModalTitle').textContent = `Edit Product #${p.product_id}`;
  document.getElementById('formProductId').value = p.product_id;
  document.getElementById('formProductName').value = p.product_name;
  document.getElementById('formCategory').value = p.category;
  document.getElementById('formPrice').value = p.price;
  document.getElementById('formStock').value = p.stock;
  document.getElementById('formImageUrl').value = p.image_url || '';
  document.getElementById('formDescription').value = p.description || '';

  document.getElementById('productFormModal').classList.add('active');
}

function closeProductFormModal() {
  document.getElementById('productFormModal').classList.remove('active');
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const productId = document.getElementById('formProductId').value;
  const productData = {
    product_name: document.getElementById('formProductName').value.trim(),
    category: document.getElementById('formCategory').value.trim(),
    price: parseFloat(document.getElementById('formPrice').value),
    stock: parseInt(document.getElementById('formStock').value, 10),
    image_url: document.getElementById('formImageUrl').value.trim(),
    description: document.getElementById('formDescription').value.trim()
  };

  const btn = document.getElementById('btnSaveProduct');
  btn.disabled = true;
  btn.textContent = 'Saving to MySQL...';

  try {
    if (productId) {
      await API.updateProduct(productId, productData);
      showToast('Product updated successfully in MySQL!', 'success');
    } else {
      await API.createProduct(productData);
      showToast('New product created successfully!', 'success');
    }
    closeProductFormModal();
    await refreshAdminData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save to Database';
  }
}

// Product Delete Modal
function openDeleteModal(productId, productName) {
  productPendingDeleteId = productId;
  document.getElementById('deleteProductName').textContent = productName;
  document.getElementById('btnConfirmDelete').onclick = executeDeleteProduct;
  document.getElementById('deleteConfirmModal').classList.add('active');
}

function closeDeleteModal() {
  productPendingDeleteId = null;
  document.getElementById('deleteConfirmModal').classList.remove('active');
}

async function executeDeleteProduct() {
  if (!productPendingDeleteId) return;
  const btn = document.getElementById('btnConfirmDelete');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const res = await API.deleteProduct(productPendingDeleteId);
    showToast(res.message, 'success');
    closeDeleteModal();
    await refreshAdminData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete Product';
  }
}

// 3. Orders Tab
async function loadAdminOrders(status = 'All') {
  const table = document.getElementById('adminOrdersTable');
  const countBadge = document.getElementById('tabCountOrders');
  if (!table) return;

  try {
    const res = await API.getAdminOrders(status);
    allAdminOrders = res.orders || [];
    if (countBadge && status === 'All') countBadge.textContent = allAdminOrders.length;

    if (allAdminOrders.length === 0) {
      table.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No orders found matching '${status}'.</td></tr>`;
      return;
    }

    table.innerHTML = allAdminOrders.map(order => {
      const formattedDate = new Date(order.order_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return `
        <tr>
          <td style="font-weight: 700; color: var(--navy-900);">#${order.order_id}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${order.customer_name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${order.customer_email}</div>
          </td>
          <td style="font-size: 0.825rem;">${order.customer_phone || 'N/A'}</td>
          <td>${formattedDate}</td>
          <td style="font-weight: 800; color: var(--blue-600);">${formatCurrency(order.total_amount)}</td>
          <td><span class="status-badge badge-${order.status.toLowerCase()}">${order.status}</span></td>
          <td>
            <select class="sort-select" style="padding: 4px 8px; font-size: 0.8rem;" onchange="handleAdminOrderStatusChange(${order.order_id}, this.value)">
              <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td style="text-align: right;">
            <button class="nav-btn nav-btn-outline" style="font-size: 0.75rem; padding: 5px 10px;" onclick="openAdminOrderDetails(${order.order_id})">
              View Items
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    table.innerHTML = `<tr><td colspan="8" style="color: var(--accent-rose); text-align: center; padding: 30px;">Error loading orders: ${err.message}</td></tr>`;
  }
}

async function handleAdminOrderStatusChange(orderId, newStatus) {
  try {
    const res = await API.updateOrderStatus(orderId, newStatus);
    showToast(res.message, 'success');
    await loadAdminStats();
    await loadAdminOrders(document.getElementById('orderStatusFilter').value);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openAdminOrderDetails(orderId) {
  const modal = document.getElementById('adminOrderModal');
  const title = document.getElementById('adminOrderModalTitle');
  const body = document.getElementById('adminOrderModalBody');

  title.textContent = `Order #${orderId} Breakdown`;
  body.innerHTML = '<p style="text-align: center; padding: 20px;">Fetching order data from MySQL...</p>';
  modal.classList.add('active');

  try {
    const res = await API.getOrder(orderId);
    const order = res.order;

    body.innerHTML = `
      <div style="background: var(--bg-page); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.85rem;">
        <div><strong>Customer:</strong> ${order.customer_name} (${order.customer_email} / ${order.customer_phone || 'No phone'})</div>
        <div style="margin-top: 6px;"><strong>Delivery Address:</strong> ${order.shipping_address || 'Standard Delivery'}</div>
      </div>

      <div style="border: 1px solid var(--border-light); border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
        ${order.items.map(item => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--border-light);">
            <div>
              <div style="font-weight: 700; color: var(--navy-900);">${item.product_name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${formatCurrency(item.price)} × ${item.quantity} units</div>
            </div>
            <strong style="color: var(--blue-600);">${formatCurrency(item.subtotal)}</strong>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; color: var(--navy-900);">
        <span>Total:</span>
        <span style="color: var(--blue-600);">${formatCurrency(order.total_amount)}</span>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<p style="color: var(--accent-rose); padding: 20px;">Failed to load order: ${err.message}</p>`;
  }
}

function closeAdminOrderModal() {
  document.getElementById('adminOrderModal').classList.remove('active');
}

// 4. Customers Tab
async function loadAdminCustomers() {
  const table = document.getElementById('adminCustomersTable');
  const countBadge = document.getElementById('tabCountCustomers');
  if (!table) return;

  try {
    const res = await API.getAdminCustomers();
    allAdminCustomers = res.customers || [];
    if (countBadge) countBadge.textContent = allAdminCustomers.length;

    table.innerHTML = allAdminCustomers.map(c => `
      <tr>
        <td style="font-weight: 700;">#${c.user_id}</td>
        <td style="font-weight: 700; color: var(--navy-900);">${c.name}</td>
        <td>${c.email}</td>
        <td>${c.phone || 'N/A'}</td>
        <td><span class="status-badge ${c.role === 'admin' ? 'badge-processing' : 'badge-delivered'}">${c.role}</span></td>
        <td style="font-weight: 600;">${c.total_orders} orders</td>
        <td style="font-weight: 800; color: var(--blue-600);">${formatCurrency(c.total_spent)}</td>
      </tr>
    `).join('');
  } catch (err) {
    table.innerHTML = `<tr><td colspan="7" style="color: var(--accent-rose); text-align: center; padding: 30px;">Error loading customers: ${err.message}</td></tr>`;
  }
}

function escapeHtml(str) {
  return (str || '').replace(/'/g, "\\'");
}
