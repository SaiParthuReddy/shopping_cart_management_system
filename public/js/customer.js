/**
 * Parthu Reddy's Online Cart Management System
 * Customer Dashboard Controller
 */

let customerOrders = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initGlobalHeader();

  if (!API.isLoggedIn()) {
    showToast('Please log in to access your customer dashboard.', 'warning');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1000);
    return;
  }

  loadUserProfile();
  await loadCustomerOrders();
});

function loadUserProfile() {
  const user = API.getUser();
  if (!user) return;

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const phoneEl = document.getElementById('profilePhone');
  const avatarEl = document.getElementById('userAvatar');
  const roleBadge = document.getElementById('profileRoleBadge');

  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = user.email;
  if (phoneEl) phoneEl.textContent = user.phone ? `📞 ${user.phone}` : 'No phone listed';
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
  if (roleBadge) roleBadge.textContent = user.role.toUpperCase();
}

async function loadCustomerOrders() {
  const tableBody = document.getElementById('customerOrdersTable');
  if (!tableBody) return;

  try {
    const res = await API.getOrders();
    customerOrders = res.orders || [];

    // Calculate Dashboard Stats
    let totalSpent = 0;
    let pendingCount = 0;
    let deliveredCount = 0;

    customerOrders.forEach(o => {
      if (o.status !== 'Cancelled') {
        totalSpent += parseFloat(o.total_amount);
      }
      if (o.status === 'Pending' || o.status === 'Processing') {
        pendingCount++;
      }
      if (o.status === 'Delivered') {
        deliveredCount++;
      }
    });

    document.getElementById('statTotalOrders').textContent = customerOrders.length;
    document.getElementById('statPendingOrders').textContent = pendingCount;
    document.getElementById('statCompletedOrders').textContent = deliveredCount;
    document.getElementById('statTotalSpent').textContent = formatCurrency(totalSpent);

    if (customerOrders.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px 0;">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">🛍️</div>
            <h4 style="font-size: 1.1rem; color: var(--navy-900); margin-bottom: 6px;">No orders found</h4>
            <p style="color: var(--text-muted); margin-bottom: 16px;">You haven't placed any orders yet.</p>
            <a href="/" class="nav-btn nav-btn-primary" style="display: inline-flex;">Start Shopping</a>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = customerOrders.map(order => {
      const statusClass = `badge-${order.status.toLowerCase()}`;
      const formattedDate = new Date(order.order_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return `
        <tr>
          <td style="font-weight: 700; color: var(--navy-900);">#${order.order_id}</td>
          <td>${formattedDate}</td>
          <td>${order.total_items} items</td>
          <td style="font-weight: 700; color: var(--blue-600);">${formatCurrency(order.total_amount)}</td>
          <td><span class="status-badge ${statusClass}">${order.status}</span></td>
          <td style="max-width: 220px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${order.shipping_address || ''}">
            ${order.shipping_address || 'Standard Delivery'}
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 8px;">
              <button class="nav-btn nav-btn-outline" style="font-size: 0.78rem; padding: 6px 12px;" onclick="viewCustomerOrderDetails(${order.order_id})">
                Details
              </button>
              ${order.status === 'Pending' ? `
                <button class="nav-btn nav-btn-outline" style="font-size: 0.78rem; padding: 6px 12px; color: var(--accent-rose); border-color: #fecaca;" onclick="cancelCustomerOrder(${order.order_id})">
                  Cancel
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--accent-rose); padding: 30px;">
          Failed to load orders: ${err.message}
        </td>
      </tr>
    `;
  }
}

async function viewCustomerOrderDetails(orderId) {
  const modal = document.getElementById('customerOrderModal');
  const title = document.getElementById('orderModalTitle');
  const body = document.getElementById('orderModalBody');

  title.textContent = `Order Details #${orderId}`;
  body.innerHTML = '<p style="text-align: center; padding: 20px;">Fetching details from MySQL...</p>';
  modal.classList.add('active');

  try {
    const res = await API.getOrder(orderId);
    const order = res.order;

    const formattedDate = new Date(order.order_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    body.innerHTML = `
      <div style="background: var(--bg-page); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Order Date</span>
          <div style="font-weight: 700; color: var(--navy-900);">${formattedDate}</div>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Status</span>
          <div><span class="status-badge badge-${order.status.toLowerCase()}">${order.status}</span></div>
        </div>
        <div style="grid-column: 1 / -1;">
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Shipping Address</span>
          <div style="font-weight: 500; color: var(--text-primary);">${order.shipping_address || 'Standard Delivery'}</div>
        </div>
      </div>

      <h4 style="font-size: 1rem; font-weight: 700; color: var(--navy-900); margin-bottom: 12px;">Ordered Items</h4>
      <div style="border: 1px solid var(--border-light); border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
        ${order.items.map(item => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-light); gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${item.image_url || getFallbackImage(item.category)}" alt="${item.product_name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px;" />
              <div>
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--navy-900);">${item.product_name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${formatCurrency(item.price)} × ${item.quantity} units</div>
              </div>
            </div>
            <div style="font-weight: 800; color: var(--blue-600);">${formatCurrency(item.subtotal)}</div>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 2px solid var(--border-light);">
        <span style="font-size: 1.1rem; font-weight: 800; color: var(--navy-900);">Total Amount Paid:</span>
        <span style="font-size: 1.3rem; font-weight: 800; color: var(--blue-600);">${formatCurrency(order.total_amount)}</span>
      </div>
    `;

  } catch (err) {
    body.innerHTML = `<p style="color: var(--accent-rose); padding: 20px;">Error: ${err.message}</p>`;
  }
}

function closeOrderModal() {
  const modal = document.getElementById('customerOrderModal');
  if (modal) modal.classList.remove('active');
}

async function cancelCustomerOrder(orderId) {
  if (!confirm(`Are you sure you want to cancel Order #${orderId}? Stock will be automatically restored to the database.`)) {
    return;
  }

  try {
    const res = await API.cancelOrder(orderId);
    showToast(res.message, 'success');
    await loadCustomerOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
