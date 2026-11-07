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

// All cart routes require authentication
router.use(authenticateToken);

// GET /api/cart - Get user's active cart items with current product data
router.get('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const query = `
      SELECT 
        c.cart_id,
        c.user_id,
        c.product_id,
        c.quantity,
        c.added_date,
        p.product_name,
        p.category,
        p.price,
        p.stock,
        p.image_url,
        (c.quantity * p.price) AS item_total
      FROM cart c
      JOIN products p ON c.product_id = p.product_id
      WHERE c.user_id = ?
      ORDER BY c.added_date DESC
    `;
    const [items] = await pool.query(query, [req.user.user_id]);

    let subtotal = 0;
    let totalItems = 0;

    items.forEach(item => {
      subtotal += parseFloat(item.item_total);
      totalItems += parseInt(item.quantity, 10);
    });

    return res.json({
      success: true,
      items,
      itemCount: totalItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat((subtotal * 0.05).toFixed(2)), // 5% standard tax
      shipping: subtotal > 0 ? (subtotal > 500 ? 0 : 15.00) : 0, // Free shipping over $500
      total: parseFloat((subtotal + (subtotal * 0.05) + (subtotal > 0 && subtotal <= 500 ? 15.00 : 0)).toFixed(2))
    });
  } catch (err) {
    console.error('Error fetching cart:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve shopping cart.' });
  }
});

// POST /api/cart - Add product to cart
router.post('/', async (req, res) => {
  if (!checkDb(res)) return;

  const { product_id, quantity = 1 } = req.body;
  const productId = parseInt(product_id, 10);
  const qtyToAdd = parseInt(quantity, 10);

  if (isNaN(productId) || isNaN(qtyToAdd) || qtyToAdd <= 0) {
    return res.status(400).json({ success: false, message: 'Valid product ID and positive quantity are required.' });
  }

  try {
    const pool = getPool();

    // Check product existence and available stock
    const [products] = await pool.query('SELECT product_id, product_name, price, stock FROM products WHERE product_id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = products[0];
    if (product.stock <= 0) {
      return res.status(400).json({ success: false, message: `"${product.product_name}" is currently out of stock.` });
    }

    // Check existing item in cart
    const [existing] = await pool.query('SELECT cart_id, quantity FROM cart WHERE user_id = ? AND product_id = ?', [req.user.user_id, productId]);

    let newQty = qtyToAdd;
    if (existing.length > 0) {
      newQty = existing[0].quantity + qtyToAdd;
    }

    // Validate that new quantity does not exceed product stock
    if (newQty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Cannot add ${qtyToAdd} more. Only ${product.stock} items in stock (you already have ${existing.length > 0 ? existing[0].quantity : 0} in cart).`
      });
    }

    // Insert or update
    await pool.query(
      `INSERT INTO cart (user_id, product_id, quantity, added_date)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE quantity = ?, added_date = NOW()`,
      [req.user.user_id, productId, newQty, newQty]
    );

    return res.json({
      success: true,
      message: `Added "${product.product_name}" to your cart.`,
      quantity: newQty
    });
  } catch (err) {
    console.error('Error adding to cart:', err);
    return res.status(500).json({ success: false, message: 'Failed to add item to cart.' });
  }
});

// PUT /api/cart/:id - Update cart item quantity
router.put('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  const cartId = parseInt(req.params.id, 10);
  const { quantity } = req.body;
  const newQty = parseInt(quantity, 10);

  if (isNaN(cartId) || isNaN(newQty)) {
    return res.status(400).json({ success: false, message: 'Invalid cart ID or quantity.' });
  }

  try {
    const pool = getPool();

    // Verify cart item belongs to this user
    const [cartRows] = await pool.query(
      `SELECT c.cart_id, c.product_id, p.product_name, p.stock 
       FROM cart c 
       JOIN products p ON c.product_id = p.product_id 
       WHERE c.cart_id = ? AND c.user_id = ?`,
      [cartId, req.user.user_id]
    );

    if (cartRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found.' });
    }

    const item = cartRows[0];

    // If quantity is 0 or less, remove item
    if (newQty <= 0) {
      await pool.query('DELETE FROM cart WHERE cart_id = ? AND user_id = ?', [cartId, req.user.user_id]);
      return res.json({
        success: true,
        message: `Removed "${item.product_name}" from cart.`,
        removed: true
      });
    }

    // Verify against product stock
    if (newQty > item.stock) {
      return res.status(400).json({
        success: false,
        message: `Maximum available stock for "${item.product_name}" is ${item.stock}.`
      });
    }

    await pool.query('UPDATE cart SET quantity = ? WHERE cart_id = ? AND user_id = ?', [newQty, cartId, req.user.user_id]);

    return res.json({
      success: true,
      message: 'Cart updated successfully.',
      quantity: newQty
    });
  } catch (err) {
    console.error('Error updating cart quantity:', err);
    return res.status(500).json({ success: false, message: 'Failed to update cart quantity.' });
  }
});

// DELETE /api/cart/:id - Remove single product from cart
router.delete('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  const cartId = parseInt(req.params.id, 10);
  if (isNaN(cartId)) {
    return res.status(400).json({ success: false, message: 'Invalid cart item ID.' });
  }

  try {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM cart WHERE cart_id = ? AND user_id = ?', [cartId, req.user.user_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    return res.json({
      success: true,
      message: 'Item removed from your cart.'
    });
  } catch (err) {
    console.error('Error removing cart item:', err);
    return res.status(500).json({ success: false, message: 'Failed to remove item from cart.' });
  }
});

// DELETE /api/cart - Clear entire cart
router.delete('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    await pool.query('DELETE FROM cart WHERE user_id = ?', [req.user.user_id]);
    return res.json({
      success: true,
      message: 'Shopping cart cleared.'
    });
  } catch (err) {
    console.error('Error clearing cart:', err);
    return res.status(500).json({ success: false, message: 'Failed to clear cart.' });
  }
});

module.exports = router;
