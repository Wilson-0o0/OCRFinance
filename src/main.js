import './style.css';
import { renderApp } from './modules/ui.js';
import { initAuth, getCurrentUser } from './modules/auth.js';

initAuth((user) => {
    if (!user) {
        window.location.href = './login.html';
    } else {
        renderApp();
    }
});

