const mysql = require('mysql2/promise');
require('dotenv').config();

// Track DB state for real-time reporting to frontend and health checks
const dbState = {
  connected: false,
  error: null,
  database: process.env.DB_NAME || 'parthu_cart_db',
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  port: process.env.DB_PORT || 3306,
  lastChecked: null,
};

let pool = null;

function getPoolConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'parthu_cart_db',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true
  };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getPoolConfig());
  }
  return pool;
}

// Test connection and auto-initialize if possible
async function testAndInitDb() {
  dbState.lastChecked = new Date();
  try {
    // First test connecting to server (without DB name if DB doesn't exist yet)
    const rootConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
    };
    
    const tempConn = await mysql.createConnection(rootConfig);
    // Create DB if not exists
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbState.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await tempConn.end();

    // Now connect to target DB pool
    pool = mysql.createPool(getPoolConfig());
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    
    dbState.connected = true;
    dbState.error = null;
    console.log(`[MySQL] Successfully connected to database '${dbState.database}' on ${dbState.host}:${dbState.port}`);

    // Auto-create tables & seed initial data
    await ensureSchemaAndSeeds();

    return { connected: true };
  } catch (err) {
    dbState.connected = false;
    dbState.error = err.message;
    console.warn(`[MySQL] Warning: Could not connect to MySQL: ${err.message}`);
    return { connected: false, error: err.message };
  }
}

async function ensureSchemaAndSeeds() {
  if (!pool) return;
  try {
    // 1. Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(15),
        role VARCHAR(20) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Products
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        product_id INT PRIMARY KEY AUTO_INCREMENT,
        product_name VARCHAR(150) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        description TEXT,
        image_url VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Cart
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart (
        cart_id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_product (user_id, product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        order_date DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'Pending',
        shipping_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Order Items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        order_item_id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed default admin if missing
    const [adminRows] = await pool.query('SELECT user_id FROM users WHERE email = ?', ['admin@parthucart.com']);
    if (adminRows.length === 0) {
      await pool.query(
        'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
        [
          'Parthu Reddy (Admin)',
          'admin@parthucart.com',
          '$2b$10$sS/kKavKu7C8arcf3URV9eeTWgzlvqXkkmFv7hzTqgcuO3rnpQ56a', // Admin@123
          '9876543210',
          'admin'
        ]
      );
      console.log('[MySQL] Default Admin seeded: admin@parthucart.com / Admin@123');
    }

    // Seed default customer if missing
    const [customerRows] = await pool.query('SELECT user_id FROM users WHERE email = ?', ['john@example.com']);
    if (customerRows.length === 0) {
      await pool.query(
        'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
        [
          'John Doe',
          'john@example.com',
          '$2b$10$V0JUXVPMapdU2nuT2JqCp.vMGBpVkuV40d9TwgYo1QjUzX073EQfS', // Customer@123
          '9812345678',
          'customer'
        ]
      );
      console.log('[MySQL] Default Customer seeded: john@example.com / Customer@123');
    }

    // Seed products if table is empty
    const [prodRows] = await pool.query('SELECT COUNT(*) AS count FROM products');
    if (prodRows[0].count === 0) {
      const initialProducts = [
        ['Sony WH-1000XM5 Wireless Headphones', 'Audio', 349.99, 25, 'Industry-leading noise canceling headphones with two processors and 8 microphones for unparalleled quietness.', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'],
        ['Apple MacBook Pro 16-Inch M3 Max', 'Laptops', 2499.00, 12, 'Blazing fast M3 Max chip with up to 128GB unified memory, Liquid Retina XDR display, and all-day battery life.', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80'],
        ['Logitech MX Master 3S Wireless Mouse', 'Accessories', 99.99, 45, 'Quiet clicks, 8K DPI tracking on any glass surface, and hyper-fast MagSpeed electromagnetic scrolling.', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80'],
        ['Samsung Galaxy S24 Ultra 512GB', 'Smartphones', 1299.99, 18, 'Titanium frame, built-in S Pen, 200MP camera with Quad Telephoto optical zoom, and Galaxy AI.', 'https://images.unsplash.com/photo-1511707171634-5f897ff025a5?w=600&auto=format&fit=crop&q=80'],
        ['Apple Watch Ultra 2 GPS + Cellular', 'Wearables', 799.00, 15, 'Rugged 49mm titanium case, precision dual-frequency GPS, up to 72 hours battery life in low power mode.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'],
        ['Keychron Q1 Pro Wireless Mechanical Keyboard', 'Accessories', 199.00, 30, 'Full aluminum CNC body, hot-swappable switches, QMK/VIA programmable keys, and double-gasket design.', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'],
        ['Bose SoundLink Revolve+ II Bluetooth Speaker', 'Audio', 279.00, 20, 'Deep, jaw-dropping 360-degree sound with durable water-resistant aluminum design and seamless handle.', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80'],
        ['Dell UltraSharp 32 4K USB-C Hub Monitor', 'Monitors', 689.99, 10, 'Brilliant 4K UHD resolution, IPS Black technology with 2000:1 contrast ratio, and built-in RJ45 port.', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80'],
        ['Anker 737 Power Bank 24,000mAh 140W', 'Accessories', 119.99, 40, 'Ultra-powerful two-way charging with smart digital display and Power Delivery 3.1 technology.', 'https://images.unsplash.com/photo-1609592424364-8f4305ce7858?w=600&auto=format&fit=crop&q=80'],
        ['Sony PlayStation 5 Slim Digital Console', 'Gaming', 449.99, 8, 'Ultra-high speed SSD, ray tracing, haptic feedback, adaptive triggers, and 3D Audio support.', 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80'],
        ['SanDisk 2TB Extreme Portable SSD USB 3.2', 'Storage', 169.99, 50, 'Up to 1050MB/s read speeds, 2-meter drop protection, IP55 water and dust resistance, carabiner loop.', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80'],
        ['Kindle Oasis 32GB Waterproof E-Reader', 'Gadgets', 279.99, 4, 'Ergonomic 7-inch Paperwhite 300 ppi display with adjustable warm light and dedicated page turn buttons.', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80']
      ];

      for (const p of initialProducts) {
        await pool.query(
          'INSERT INTO products (product_name, category, price, stock, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
          p
        );
      }
      console.log('[MySQL] 12 initial products seeded successfully.');
    }
  } catch (err) {
    console.error('[MySQL] Error initializing schema:', err.message);
  }
}

module.exports = {
  getPool,
  testAndInitDb,
  dbState
};
