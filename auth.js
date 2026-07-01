/* ============================================================
   auth.js — BUU Pharmacy CPE Authentication
   ============================================================
   วิธีตั้งค่า:
   1. ไป https://console.cloud.google.com
   2. APIs & Services → Credentials → + CREATE CREDENTIALS
      → OAuth 2.0 Client ID → Web application
   3. Authorized JavaScript origins:
        https://thiraphongpor-dot.github.io
   4. คัดลอก Client ID มาแทนที่ค่า CLIENT_ID ด้านล่าง
   5. ใส่อีเมล @go.buu.ac.th ของคุณใน ADMIN_EMAILS
   ============================================================ */

const AUTH_CONFIG = {
  // ← แก้ไขค่านี้: Google OAuth 2.0 Client ID ของคุณ
  CLIENT_ID: '299883355949-q40iqlagj0kj3oqlt9lfhs7aiii3g0vh.apps.googleusercontent.com',

  // ← แก้ไขค่านี้: อีเมล @go.buu.ac.th ของคุณ (admin)
  ADMIN_EMAILS: ['thiraphong.ge@go.buu.ac.th'],

  // Domain ที่อนุญาตให้ login (ห้ามเปลี่ยน)
  ALLOWED_DOMAIN: 'go.buu.ac.th',

  SESSION_KEY: 'buu_pharma_auth_v1',
  LOGIN_PAGE:  'login.html',
  HOME_PAGE:   'index.html',
};

/* ── Session ── */
function getUser() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY)); }
  catch { return null; }
}
function setUser(u) {
  sessionStorage.setItem(AUTH_CONFIG.SESSION_KEY, JSON.stringify(u));
}
function clearUser() {
  sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
}

/* ── Role ── */
function isAdmin(user) {
  if (!user) return false;
  const admins = AUTH_CONFIG.ADMIN_EMAILS.map(e => e.trim().toLowerCase());
  return admins.includes((user.email || '').toLowerCase());
}
function getRole(user) {
  return isAdmin(user) ? 'admin' : 'user';
}

/* ── Guards ── */
function requireUser() {
  const u = getUser();
  if (!u) { location.replace(AUTH_CONFIG.LOGIN_PAGE); return null; }
  return u;
}
function requireAdmin() {
  const u = getUser();
  if (!u) { location.replace(AUTH_CONFIG.LOGIN_PAGE); return null; }
  if (!isAdmin(u)) { location.replace(AUTH_CONFIG.HOME_PAGE); return null; }
  return u;
}

/* ── Logout ── */
function logout() {
  clearUser();
  try { google.accounts.id.disableAutoSelect(); } catch {}
  location.replace(AUTH_CONFIG.LOGIN_PAGE);
}

/* ── Decode Google JWT (client-side only) ── */
function decodeJWT(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch { return null; }
}

/* ── Render user badge (ใช้ใน index.html) ── */
function renderUserBadge(containerId, user) {
  const el = document.getElementById(containerId);
  if (!el || !user) return;
  const role = getRole(user);
  const roleLabel = role === 'admin' ? '⚡ ADMIN' : '◉ USER';
  const roleColor = role === 'admin' ? '#CCFF00' : '#22d3ee';
  const short = user.name
    ? user.name.split(' ')[0]
    : user.email.split('@')[0];
  el.innerHTML = `
    <div class="auth-badge">
      ${user.picture
        ? `<img src="${user.picture}" class="auth-avatar" alt="" onerror="this.remove()">`
        : `<div class="auth-avatar-fallback">${short[0].toUpperCase()}</div>`}
      <span class="auth-name">${short}</span>
      <span class="auth-role" style="color:${roleColor}">${roleLabel}</span>
      <button class="auth-logout" onclick="logout()">ออกจากระบบ</button>
    </div>`;
}
