import { login, signup, initAuth, getCurrentUser } from './modules/auth.js';

// Initialize auth state
initAuth();

// Redirect if already logged in
if (getCurrentUser()) {
    window.location.href = '/';
}

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const linkSignup = document.getElementById('link-signup');
const linkLogin = document.getElementById('link-login');

// Toggle Forms
linkSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

linkLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Login Handler
document.getElementById('btn-login').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember').checked;

    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }

    const success = await login(username, password, remember);
    if (success) {
        window.location.href = '/';
    } else {
        alert('Invalid credentials');
    }
});

// Signup Handler
document.getElementById('btn-signup').addEventListener('click', async () => {
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;

    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }

    try {
        await signup(username, password);
        window.location.href = '/';
    } catch (err) {
        alert(err.message);
    }
});
