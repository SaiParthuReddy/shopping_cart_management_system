const express = require('express');
const router = express.Router();
const { getPool, dbState } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

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

// All order routes require authentication
router.use(authenticateToken);

// POST /api/orders/checkout - Place order from active cart inside a MySQL Transaction
router.post('/checkout', async (req, res) => {
  if (!checkDb(res)) return;

  const { shipping_address } = req.body;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    // 1. Begin Database Transaction
    await connection.beginTransaction();

    // 2. Fetch current cart items with row locking for stock safety
    const [cartItems] = await connection.query(
      `SELECT c.cart_id, c.product_id, c.quantity, p.product_name, p.price, p.stock
       FROM cart c
       JOIN products p ON c.product_id = p.product_id
       WHERE c.user_id = ?
       FOR UPDATE`,
      [req.user.user_id]
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add items to place an order.'
      });
    }

    // 3. Verify stock and calculate verified server-side total
    let calculatedSubtotal = 0;

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${item.product_name}". Available: ${item.stock}, requested: ${item.quantity}.`
        });
      }
      calculatedSubtotal += parseFloat(item.price) * parseInt(item.quantity, 10);
    }

    // Add 5% tax and shipping
    const tax = parseFloat((calculatedSubtotal * 0.05).toFixed(2));
    const shipping = calculatedSubtotal > 500 ? 0 : 15.00;
    const finalTotal = parseFloat((calculatedSubtotal + tax + shipping).toFixed(2));

    // 4. Create Order record
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, total_amount, order_date, status, shipping_address)
       VALUES (?, ?, ?, 'Pending', ?)`,
      [req.user.user_id, finalTotal, today, shipping_address || 'Standard Delivery Address']
    );

    const newOrderId = orderResult.insertId;

    // 5. Create Order Items & Reduce Product Stock
    for (const item of cartItems) {
      // Insert item with frozen current price
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [newOrderId, item.product_id, item.quantity, item.price]
      );

      // Reduce product stock
      await connection.query(
        `UPDATE products 
         SET stock = stock - ? 
         WHERE product_id = ?`,
        [item.quantity, item.product_id]
      );
    }

    // 6. Clear user's cart
    await connection.query('DELETE FROM cart WHERE user_id = ?', [req.user.user_id]);

    // 7. Commit Transaction
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      orderId: newOrderId,
      totalAmount: finalTotal,
      orderDate: today,
      status: 'Pending'
    });
  } catch (err) {
    await connection.rollback();
    console.error('Checkout Transaction Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Transaction failed while processing order. All changes were rolled back safely.'
    });
  } finally {
    connection.release();
  }
});

// GET /api/orders - Get user's order history
router.get('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const [orders] = await pool.query(
      `SELECT o.order_id, o.user_id, o.total_amount, o.order_date, o.status, o.shipping_address, o.created_at,
              COUNT(oi.order_item_id) AS total_items
       FROM orders o
       LEFT JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.user_id = ?
       GROUP BY o.order_id
       ORDER BY o.order_id DESC`,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      orders
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve order history.' });
  }
});

// GET /api/orders/:id - Get specific order details with item breakdown
router.get('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID.' });
  }

  try {
    const pool = getPool();
    
    // Check permission (admin or order owner)
    let orderQuery = 'SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone FROM orders o JOIN users u ON o.user_id = u.user_id WHERE o.order_id = ?';
    const params = [orderId];

    if (req.user.role !== 'admin') {
      orderQuery += ' AND o.user_id = ?';
      params.push(req.user.user_id);
    }

    const [orders] = await pool.query(orderQuery, params);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    const order = orders[0];

    // Get order items
    const [items] = await pool.query(
      `SELECT oi.order_item_id, oi.order_id, oi.product_id, oi.quantity, oi.price,
              p.product_name, p.category, p.image_url, (oi.quantity * oi.price) AS subtotal
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    order.items = items;

    return res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error('Error fetching order details:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve order details.' });
  }
});

// POST /api/orders/:id/cancel - Customer can cancel a 'Pending' order (restores stock)
router.post('/:id/cancel', async (req, res) => {
  if (!checkDb(res)) return;

  const orderId = parseInt(req.params.id, 10);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT order_id, user_id, status FROM orders WHERE order_id = ? AND user_id = ? FOR UPDATE',
      [orderId, req.user.user_id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];
    if (order.status !== 'Pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because its status is already "${order.status}".`
      });
    }

    // Restore stock for all order items
    const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
    for (const item of items) {
      await connection.query('UPDATE products SET stock = stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
    }

    // Update status to Cancelled
    await connection.query("UPDATE orders SET status = 'Cancelled' WHERE order_id = ?", [orderId]);

    await connection.commit();

    return res.json({
      success: true,
      message: 'Order # ' + orderId + ' has been cancelled, and product stock has been restored.'
    });
  } catch (err) {
    await connection.rollback();
    console.error('Order cancellation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel order.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
