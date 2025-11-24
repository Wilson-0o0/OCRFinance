import { registerUser, findUser, getAllUsers } from './db.js';

let currentUser = null;

export const initAuth = () => {
    const localUser = localStorage.getItem('ocr_user');
    const sessionUser = sessionStorage.getItem('ocr_user');

    if (localUser) {
        currentUser = JSON.parse(localUser);
    } else if (sessionUser) {
        currentUser = JSON.parse(sessionUser);
    }
};

export const getCurrentUser = () => currentUser;

export const login = async (username, password, remember = false) => {
    const user = await findUser(username);
    if (user && user.password === password) {
        currentUser = { username: user.username, role: user.role };
        if (remember) {
            localStorage.setItem('ocr_user', JSON.stringify(currentUser));
        } else {
            sessionStorage.setItem('ocr_user', JSON.stringify(currentUser));
        }
        return true;
    }
    return false;
};

export const signup = async (username, password) => {
    const existing = await findUser(username);
    if (existing) {
        throw new Error('Username already exists');
    }

    const allUsers = await getAllUsers();
    const role = allUsers.length === 0 ? 'admin' : 'user';

    const newUser = { username, password, role };
    await registerUser(newUser);

    // Auto login after signup
    currentUser = { username, role };
    sessionStorage.setItem('ocr_user', JSON.stringify(currentUser));
    return true;
};

export const logout = () => {
    currentUser = null;
    localStorage.removeItem('ocr_user');
    sessionStorage.removeItem('ocr_user');
};
