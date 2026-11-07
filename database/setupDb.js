require('dotenv').config();
const { testAndInitDb, dbState } = require('../config/db');

async function run() {
  console.log('--- Setting up Parthu Reddy\'s Online Cart Database ---');
  console.log(`Connecting to MySQL on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}...`);
  const result = await testAndInitDb();
  if (result.connected) {
    console.log('✅ Database setup and verification completed successfully!');
    process.exit(0);
  } else {
    console.error('❌ Failed to connect to MySQL:', result.error);
    console.log('\nPlease make sure:');
    console.log('1. MySQL server is running (e.g., via Services or XAMPP / WampServer / MySQL Workbench)');
    console.log('2. Your .env file contains correct DB_USER and DB_PASSWORD');
    console.log('3. The port (default 3306) is accessible.');
    process.exit(1);
  }
}

run();
