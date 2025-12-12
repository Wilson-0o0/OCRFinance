import { login, signup, initAuth, getCurrentUser, resetUserPassword } from './modules/auth.js';

// Initialize auth state
// Initialize auth state and redirect if logged in
initAuth((user) => {
    if (user) {
        window.location.href = './index.html';
    }
});

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
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember').checked;

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        const success = await login(email, password, remember);
        if (success) {
            window.location.href = './index.html';
        }
    } catch (err) {
        alert('Login failed: ' + err.message);
    }
});

// Signup Handler
document.getElementById('btn-signup').addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        await signup(email, password);
        window.location.href = './index.html';
    } catch (err) {
        alert(err.message);
    }
});

// Forgot Password & Reset Handlers
const resetForm = document.getElementById('reset-form');
const linkForgotPassword = document.getElementById('link-forgot-password');
const linkBackLogin = document.getElementById('link-back-login');

linkForgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    resetForm.classList.remove('hidden');
});

linkBackLogin.addEventListener('click', (e) => {
    e.preventDefault();
    resetForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

document.getElementById('btn-reset').addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value;

    if (!email) {
        alert('Please enter your email');
        return;
    }

    try {
        const result = await resetUserPassword(email);
        if (result.success) {
            alert('Password reset link sent to your email!');
            resetForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
});
