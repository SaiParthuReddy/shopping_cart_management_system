/**
 * Parthu Reddy's Online Cart Management System
 * Authentication Controller (Login & Registration)
 */

document.addEventListener('DOMContentLoaded', async () => {
  await initGlobalHeader();

  // If already logged in, redirect
  if (API.isLoggedIn()) {
    const user = API.getUser();
    if (user && user.role === 'admin') {
      window.location.href = '/admin.html';
    } else {
      window.location.href = '/customer-dashboard.html';
    }
    return;
  }

  // Check URL query parameters for ?tab=register
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'register') {
    switchAuthTab('register');
  }
});

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const alertEl = document.getElementById('authAlert');

  if (alertEl) alertEl.style.display = 'none';

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabLoginBtn.classList.remove('active');
    tabRegisterBtn.classList.add('active');
  }
}

function fillDemo(role) {
  switchAuthTab('login');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');

  if (role === 'admin') {
    emailInput.value = 'admin@parthucart.com';
    passwordInput.value = 'Admin@123';
  } else {
    emailInput.value = 'john@example.com';
    passwordInput.value = 'Customer@123';
  }
}

function showAuthAlert(message, type = 'error') {
  const alertEl = document.getElementById('authAlert');
  if (!alertEl) return;

  alertEl.style.display = 'block';
  if (type === 'error') {
    alertEl.style.background = '#fee2e2';
    alertEl.style.color = '#991b1b';
    alertEl.style.border = '1px solid #fecaca';
    alertEl.innerHTML = `⚠️ ${message}`;
  } else {
    alertEl.style.background = '#d1fae5';
    alertEl.style.color = '#065f46';
    alertEl.style.border = '1px solid #a7f3d0';
    alertEl.innerHTML = `✅ ${message}`;
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('btnLoginSubmit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Verifying credentials...</span>';

  try {
    const res = await API.login(email, password);
    showAuthAlert(res.message, 'success');
    showToast(res.message, 'success');

    setTimeout(() => {
      if (res.user && res.user.role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/';
      }
    }, 800);
  } catch (err) {
    showAuthAlert(err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Sign In to Account</span><span>→</span>';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const submitBtn = document.getElementById('btnRegisterSubmit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Creating account...</span>';

  try {
    const res = await API.register(name, email, password, phone);
    showAuthAlert(res.message, 'success');
    showToast('Registration successful! Redirecting...', 'success');

    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (err) {
    showAuthAlert(err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Create Customer Account</span><span>→</span>';
  }
}
