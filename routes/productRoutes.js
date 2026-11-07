const express = require('express');
const router = express.Router();
const { getPool, dbState } = require('../config/db');

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

// GET /api/products/categories - Distinct categories list
router.get('/categories', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category ASC');
    const categories = rows.map(r => r.category);
    return res.json({ success: true, categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

// GET /api/products - Browse, search, filter and sort
router.get('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const { q, category, minPrice, maxPrice, sort, limit } = req.query;

    let query = 'SELECT product_id, product_name, category, price, stock, description, image_url, created_at FROM products WHERE 1=1';
    const params = [];

    // Search by product name or description
    if (q && q.trim()) {
      query += ' AND (product_name LIKE ? OR description LIKE ?)';
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    // Filter by category
    if (category && category.trim() && category !== 'All') {
      query += ' AND category = ?';
      params.push(category.trim());
    }

    // Filter by min price
    if (minPrice && !isNaN(minPrice)) {
      query += ' AND price >= ?';
      params.push(parseFloat(minPrice));
    }

    // Filter by max price
    if (maxPrice && !isNaN(maxPrice)) {
      query += ' AND price <= ?';
      params.push(parseFloat(maxPrice));
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        query += ' ORDER BY price ASC';
        break;
      case 'price_desc':
        query += ' ORDER BY price DESC';
        break;
      case 'name_asc':
        query += ' ORDER BY product_name ASC';
        break;
      case 'stock_desc':
        query += ' ORDER BY stock DESC';
        break;
      default:
        query += ' ORDER BY product_id DESC';
    }

    if (limit && !isNaN(limit)) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const [products] = await pool.query(query, params);

    return res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve products from database.' });
  }
});

// GET /api/products/:id - Single product details
router.get('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  try {
    const pool = getPool();
    const [products] = await pool.query(
      'SELECT product_id, product_name, category, price, stock, description, image_url, created_at FROM products WHERE product_id = ?',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.json({
      success: true,
      product: products[0]
    });
  } catch (err) {
    console.error('Error fetching product details:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve product details.' });
  }
});

module.exports = router;
