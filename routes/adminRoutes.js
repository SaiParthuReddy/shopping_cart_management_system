const express = require('express');
const router = express.Router();
const { getPool, dbState } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

function checkDb(res) {
  if (!dbState.connected) {
    res.status(503).json({
      success: false,
      message: 'MySQL Database is currently unreachable. Please verify MySQL service and .env configuration.',
      dbError: dbState.error
    });
    return false;
  }
  return true;
}

// All admin routes require authentication AND admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/dashboard - Aggregated stats and low-stock alerts
router.get('/dashboard', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();

    // 1. Total products
    const [prodCount] = await pool.query('SELECT COUNT(*) AS total_products FROM products');
    // 2. Total customers
    const [custCount] = await pool.query("SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer'");
    // 3. Total orders & revenue
    const [orderStats] = await pool.query(`
      SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status != 'Cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending_orders
      FROM orders
    `);

    // 4. Low stock products (stock <= 5)
    const [lowStock] = await pool.query(`
      SELECT product_id, product_name, category, price, stock, image_url 
      FROM products 
      WHERE stock <= 5 
      ORDER BY stock ASC
    `);

    // 5. Recent orders
    const [recentOrders] = await pool.query(`
      SELECT o.order_id, o.user_id, u.name AS customer_name, u.email AS customer_email,
             o.total_amount, o.order_date, o.status, o.created_at
      FROM orders o
      JOIN users u ON o.user_id = u.user_id
      ORDER BY o.order_id DESC
      LIMIT 5
    `);

    return res.json({
      success: true,
      stats: {
        totalProducts: prodCount[0].total_products,
        totalCustomers: custCount[0].total_customers,
        totalOrders: orderStats[0].total_orders,
        pendingOrders: orderStats[0].pending_orders,
        totalRevenue: parseFloat(orderStats[0].total_revenue)
      },
      lowStockProducts: lowStock,
      recentOrders
    });
  } catch (err) {
    console.error('Error fetching admin dashboard stats:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin dashboard metrics.' });
  }
});

// GET /api/admin/products - List all products for management
router.get('/products', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const [products] = await pool.query(
      'SELECT product_id, product_name, category, price, stock, description, image_url, created_at FROM products ORDER BY product_id DESC'
    );
    return res.json({ success: true, count: products.length, products });
  } catch (err) {
    console.error('Error fetching admin products:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve products.' });
  }
});

// POST /api/admin/products - Add a new product
router.post('/products', async (req, res) => {
  if (!checkDb(res)) return;

  const { product_name, category, price, stock, description, image_url } = req.body;

  if (!product_name || !product_name.trim()) {
    return res.status(400).json({ success: false, message: 'Product name is required.' });
  }
  if (!category || !category.trim()) {
    return res.status(400).json({ success: false, message: 'Category is required.' });
  }
  if (price === undefined || isNaN(price) || parseFloat(price) < 0) {
    return res.status(400).json({ success: false, message: 'Valid positive price is required.' });
  }
  if (stock === undefined || isNaN(stock) || parseInt(stock, 10) < 0) {
    return res.status(400).json({ success: false, message: 'Valid non-negative stock number is required.' });
  }

  try {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO products (product_name, category, price, stock, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        product_name.trim(),
        category.trim(),
        parseFloat(price),
        parseInt(stock, 10),
        description ? description.trim() : '',
        image_url ? image_url.trim() : null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Product added successfully!',
      product_id: result.insertId
    });
  } catch (err) {
    console.error('Error creating product:', err);
    return res.status(500).json({ success: false, message: 'Failed to add product.' });
  }
});

// PUT /api/admin/products/:id - Update product details & price & stock
router.put('/products/:id', async (req, res) => {
  if (!checkDb(res)) return;

  const productId = parseInt(req.params.id, 10);
  const { product_name, category, price, stock, description, image_url } = req.body;

  if (isNaN(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }
  if (!product_name || !product_name.trim()) {
    return res.status(400).json({ success: false, message: 'Product name is required.' });
  }
  if (!category || !category.trim()) {
    return res.status(400).json({ success: false, message: 'Category is required.' });
  }
  if (price === undefined || isNaN(price) || parseFloat(price) < 0) {
    return res.status(400).json({ success: false, message: 'Valid positive price is required.' });
  }
  if (stock === undefined || isNaN(stock) || parseInt(stock, 10) < 0) {
    return res.status(400).json({ success: false, message: 'Valid non-negative stock count is required.' });
  }

  try {
    const pool = getPool();
    const [result] = await pool.query(
      `UPDATE products 
       SET product_name = ?, category = ?, price = ?, stock = ?, description = ?, image_url = ?
       WHERE product_id = ?`,
      [
        product_name.trim(),
        category.trim(),
        parseFloat(price),
        parseInt(stock, 10),
        description ? description.trim() : '',
        image_url ? image_url.trim() : null,
        productId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.json({
      success: true,
      message: 'Product updated successfully.'
    });
  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
});

// PATCH /api/admin/products/:id/stock - Quick stock update
router.patch('/products/:id/stock', async (req, res) => {
  if (!checkDb(res)) return;

  const productId = parseInt(req.params.id, 10);
  const { stock } = req.body;

  if (isNaN(productId) || stock === undefined || isNaN(stock) || parseInt(stock, 10) < 0) {
    return res.status(400).json({ success: false, message: 'Invalid product ID or stock value.' });
  }

  try {
    const pool = getPool();
    const [result] = await pool.query('UPDATE products SET stock = ? WHERE product_id = ?', [parseInt(stock, 10), productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.json({
      success: true,
      message: 'Product stock updated successfully.'
    });
  } catch (err) {
    console.error('Error updating stock:', err);
    return res.status(500).json({ success: false, message: 'Failed to update product stock.' });
  }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', async (req, res) => {
  if (!checkDb(res)) return;

  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  try {
    const pool = getPool();
    // Foreign key in cart cascades; in order_items it prevents deletion or order items retain record
    // Let's check if this product has existing orders
    const [orderCheck] = await pool.query('SELECT order_item_id FROM order_items WHERE product_id = ? LIMIT 1', [productId]);
    if (orderCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This product cannot be deleted because it is associated with completed or existing customer orders. You can set its stock to 0 instead.'
      });
    }

    const [result] = await pool.query('DELETE FROM products WHERE product_id = ?', [productId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.json({
      success: true,
      message: 'Product deleted successfully.'
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
});

// GET /api/admin/orders - View all customer orders
router.get('/orders', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const { status } = req.query;

    let query = `
      SELECT o.order_id, o.user_id, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             o.total_amount, o.order_date, o.status, o.shipping_address, o.created_at,
             COUNT(oi.order_item_id) AS total_items
      FROM orders o
      JOIN users u ON o.user_id = u.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
    `;
    const params = [];

    if (status && status !== 'All') {
      query += ' WHERE o.status = ?';
      params.push(status);
    }

    query += ' GROUP BY o.order_id ORDER BY o.order_id DESC';

    const [orders] = await pool.query(query, params);
    return res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve orders.' });
  }
});

// PUT /api/admin/orders/:id/status - Update order status (Pending, Processing, Shipped, Delivered, Cancelled)
router.put('/orders/:id/status', async (req, res) => {
  if (!checkDb(res)) return;

  const orderId = parseInt(req.params.id, 10);
  const { status } = req.body;

  const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orders] = await connection.query('SELECT order_id, status FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const currentStatus = orders[0].status;

    // If changing to Cancelled and wasn't previously Cancelled, restore stock
    if (status === 'Cancelled' && currentStatus !== 'Cancelled') {
      const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await connection.query('UPDATE products SET stock = stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    // If changing from Cancelled back to another status, re-deduct stock if available
    if (currentStatus === 'Cancelled' && status !== 'Cancelled') {
      const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await connection.query('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    await connection.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, orderId]);
    await connection.commit();

    return res.json({
      success: true,
      message: `Order #${orderId} status updated to ${status}.`
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error updating order status:', err);
    return res.status(500).json({ success: false, message: 'Failed to update order status.' });
  } finally {
    connection.release();
  }
});

// GET /api/admin/customers - List all registered customers
router.get('/customers', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const query = `
      SELECT u.user_id, u.name, u.email, u.phone, u.role, u.created_at,
             COUNT(DISTINCT o.order_id) AS total_orders,
             COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN o.total_amount ELSE 0 END), 0) AS total_spent
      FROM users u
      LEFT JOIN orders o ON u.user_id = o.user_id
      GROUP BY u.user_id
      ORDER BY u.user_id DESC
    `;
    const [customers] = await pool.query(query);
    return res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    console.error('Error fetching customers:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve customers.' });
  }
});

module.exports = router;
