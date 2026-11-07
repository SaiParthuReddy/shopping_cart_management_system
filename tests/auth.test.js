const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

async function testAuthLogic() {
  console.log('Testing authentication token generation and password verification...');

  // Test bcrypt
  const plain = 'SecretPassword123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plain, salt);
  const isMatch = await bcrypt.compare(plain, hash);

  if (!isMatch) {
    throw new Error('Bcrypt hashing and verification failed!');
  }
  console.log('✅ Bcrypt hash & compare: PASSED');

  // Test JWT
  const user = { user_id: 1, name: 'Parthu Reddy', email: 'admin@parthucart.com', role: 'admin' };
  const token = generateToken(user);
  if (!token || typeof token !== 'string') {
    throw new Error('JWT generation failed!');
  }
  console.log('✅ JWT generation & signing: PASSED (Token length: ' + token.length + ')');
}

testAuthLogic().then(() => {
  console.log('Auth logic tests passed completely!');
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
