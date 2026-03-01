/**
 * auth.js
 * Client-side authentication module.
 *
 * Admin credentials are stored as a SHA-256 hash so the plain-text
 * password never appears in localStorage.
 *
 * Default credentials: admin / admin2025
 * (Change ADMIN_USER and ADMIN_HASH below to update them.)
 */

const STORAGE_KEY  = 'ead-auth-session';
const ADMIN_USER   = 'admin';
// SHA-256 of "admin2025"
const ADMIN_HASH   = '0e89f223e226ae63268cf39152ab75722e811b89d29efb22a852f1667bd22ae0';

// ---- Callbacks ----
let onLoginCb  = null;
let onLogoutCb = null;

// ---- Public API ----

export function setupAuth({ onLogin, onLogout }) {
  onLoginCb  = onLogin;
  onLogoutCb = onLogout;
}

export function isLoggedIn() {
  return localStorage.getItem(STORAGE_KEY) === 'authenticated';
}

/** Attempt login. Returns true on success. */
export async function login(username, password) {
  const hash = await sha256(password);
  if (username.trim().toLowerCase() === ADMIN_USER && hash === ADMIN_HASH) {
    localStorage.setItem(STORAGE_KEY, 'authenticated');
    if (onLoginCb) onLoginCb();
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  if (onLogoutCb) onLogoutCb();
}

// ---- SHA-256 helper (Web Crypto API) ----
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
