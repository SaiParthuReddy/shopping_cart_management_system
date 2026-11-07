require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { testAndInitDb, dbState } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Database connection status API
app.get('/api/db-status', (req, res) => {
  res.json({
    connected: dbState.connected,
    error: dbState.error,
    database: dbState.database,
    host: dbState.host,
    port: dbState.port,
    lastChecked: dbState.lastChecked
  });
});

// Retry DB connection manually if user updated .env or started MySQL
app.post('/api/db-retry', async (req, res) => {
  const result = await testAndInitDb();
  res.json({
    success: result.connected,
    connected: dbState.connected,
    error: dbState.error,
    message: result.connected ? 'Successfully connected to MySQL database!' : 'Failed to connect: ' + result.error
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all API 404
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// Serve frontend pages for deep navigation
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customer-dashboard.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.'
  });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🛍️  Parthu Reddy's Online Cart Management System`);
  console.log(`🌐 Server running locally at: http://localhost:${PORT}`);
  console.log(`=======================================================`);

  // Attempt initial MySQL connection and table setup
  await testAndInitDb();
});
