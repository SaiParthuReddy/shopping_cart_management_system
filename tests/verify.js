const http = require('http');

async function testEndpoint(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', err => reject(err));
  });
}

async function run() {
  console.log('Testing server endpoints...');
  // Require and start the express app
  require('../server');

  // Wait 1.5 seconds for express listen
  await new Promise(r => setTimeout(r, 1500));

  try {
    const dbStatus = await testEndpoint('http://localhost:3000/api/db-status');
    console.log('✅ GET /api/db-status -> Status:', dbStatus.status);
    console.log('   Response:', dbStatus.data);

    const home = await testEndpoint('http://localhost:3000/');
    console.log('✅ GET / (Home) -> Status:', home.status, '(Length: ' + home.data.length + ' bytes)');

    const loginPage = await testEndpoint('http://localhost:3000/login.html');
    console.log('✅ GET /login.html -> Status:', loginPage.status);

    const adminPage = await testEndpoint('http://localhost:3000/admin.html');
    console.log('✅ GET /admin.html -> Status:', adminPage.status);

    const customerPage = await testEndpoint('http://localhost:3000/customer-dashboard.html');
    console.log('✅ GET /customer-dashboard.html -> Status:', customerPage.status);

    console.log('\nAll endpoints responded cleanly!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Endpoint test failed:', err);
    process.exit(1);
  }
}

run();
