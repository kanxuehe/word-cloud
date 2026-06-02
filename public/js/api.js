const TOKEN_KEY = 'wc_token';
const USER_KEY = 'wc_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      if (!location.pathname.endsWith('/login.html')) {
        location.href = '/login.html';
      }
    }
    const err = new Error((body && body.message) || `请求失败 (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  register: (username, password) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  listWords: (knownFilter) => {
    const q = knownFilter === undefined ? '' : `?known=${knownFilter}`;
    return request(`/api/words${q}`);
  },
  createWord: (data) =>
    request('/api/words', { method: 'POST', body: JSON.stringify(data) }),
  updateWord: (id, data) =>
    request(`/api/words/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setKnown: (id, known) =>
    request(`/api/words/${id}/known`, {
      method: 'PATCH',
      body: JSON.stringify({ known }),
    }),
  deleteWord: (id) => request(`/api/words/${id}`, { method: 'DELETE' }),
};

export function requireAuth() {
  if (!getToken()) {
    location.href = '/login.html';
  }
}

export function logout() {
  clearSession();
  location.href = '/login.html';
}

export function showToast(message, type = '') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast fixed top-4 right-4 bg-slate-800 border border-slate-700 px-4 py-3 rounded-lg shadow-lg text-sm z-[100] max-w-[360px] opacity-0 -translate-y-2 transition-all duration-200 pointer-events-none';
    document.body.appendChild(el);
  }
  el.textContent = message;
  const typeBorder = type === 'success' ? 'border-green-500' : type === 'error' ? 'border-red-500' : 'border-slate-700';
  el.className = `toast fixed top-4 right-4 bg-slate-800 border px-4 py-3 rounded-lg shadow-lg text-sm z-[100] max-w-[360px] opacity-100 translate-y-0 transition-all duration-200 pointer-events-none ${typeBorder}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.className = `toast fixed top-4 right-4 bg-slate-800 border border-slate-700 px-4 py-3 rounded-lg shadow-lg text-sm z-[100] max-w-[360px] opacity-0 -translate-y-2 transition-all duration-200 pointer-events-none`;
  }, 2500);
}
