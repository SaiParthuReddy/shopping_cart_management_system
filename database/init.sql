-- Parthu Reddy's Online Cart Management System
-- Database Schema & Initial Seed Data

CREATE DATABASE IF NOT EXISTS parthu_cart_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parthu_cart_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    role VARCHAR(20) DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Products Table
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

-- 3. Cart Table
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

-- 4. Orders Table
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

-- 5. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Initial Users (Password for admin: Admin@123, for customer: Customer@123)
INSERT INTO users (name, email, password, phone, role)
SELECT 'Parthu Reddy (Admin)', 'admin@parthucart.com', '$2b$10$sS/kKavKu7C8arcf3URV9eeTWgzlvqXkkmFv7hzTqgcuO3rnpQ56a', '9876543210', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@parthucart.com');

INSERT INTO users (name, email, password, phone, role)
SELECT 'John Doe', 'john@example.com', '$2b$10$V0JUXVPMapdU2nuT2JqCp.vMGBpVkuV40d9TwgYo1QjUzX073EQfS', '9812345678', 'customer'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'john@example.com');

-- Seed Initial Products
INSERT INTO products (product_name, category, price, stock, description, image_url)
SELECT * FROM (
    SELECT 'Sony WH-1000XM5 Wireless Headphones' AS product_name, 'Audio' AS category, 349.99 AS price, 25 AS stock, 'Industry-leading noise canceling headphones with two processors and 8 microphones for unparalleled quietness.' AS description, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80' AS image_url UNION ALL
    SELECT 'Apple MacBook Pro 16-Inch M3 Max', 'Laptops', 2499.00, 12, 'Blazing fast M3 Max chip with up to 128GB unified memory, Liquid Retina XDR display, and all-day battery life.', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Logitech MX Master 3S Wireless Mouse', 'Accessories', 99.99, 45, 'Quiet clicks, 8K DPI tracking on any glass surface, and hyper-fast MagSpeed electromagnetic scrolling.', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Samsung Galaxy S24 Ultra 512GB', 'Smartphones', 1299.99, 18, 'Titanium frame, built-in S Pen, 200MP camera with Quad Telephoto optical zoom, and Galaxy AI.', 'https://images.unsplash.com/photo-1511707171634-5f897ff025a5?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Apple Watch Ultra 2 GPS + Cellular', 'Wearables', 799.00, 15, 'Rugged 49mm titanium case, precision dual-frequency GPS, up to 72 hours battery life in low power mode.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Keychron Q1 Pro Wireless Mechanical Keyboard', 'Accessories', 199.00, 30, 'Full aluminum CNC body, hot-swappable switches, QMK/VIA programmable keys, and double-gasket design.', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Bose SoundLink Revolve+ II Bluetooth Speaker', 'Audio', 279.00, 20, 'Deep, jaw-dropping 360-degree sound with durable water-resistant aluminum design and seamless handle.', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Dell UltraSharp 32 4K USB-C Hub Monitor', 'Monitors', 689.99, 10, 'Brilliant 4K UHD resolution, IPS Black technology with 2000:1 contrast ratio, and built-in RJ45 port.', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Anker 737 Power Bank 24,000mAh 140W', 'Accessories', 119.99, 40, 'Ultra-powerful two-way charging with smart digital display and Power Delivery 3.1 technology.', 'https://images.unsplash.com/photo-1609592424364-8f4305ce7858?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Sony PlayStation 5 Slim Digital Console', 'Gaming', 449.99, 8, 'Ultra-high speed SSD, ray tracing, haptic feedback, adaptive triggers, and 3D Audio support.', 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'SanDisk 2TB Extreme Portable SSD USB 3.2', 'Storage', 169.99, 50, 'Up to 1050MB/s read speeds, 2-meter drop protection, IP55 water and dust resistance, carabiner loop.', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80' UNION ALL
    SELECT 'Kindle Oasis 32GB Waterproof E-Reader', 'Gadgets', 279.99, 3, 'Ergonomic 7-inch Paperwhite 300 ppi display with adjustable warm light and dedicated page turn buttons.', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);
