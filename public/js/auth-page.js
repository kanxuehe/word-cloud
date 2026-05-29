import { api, setSession, getToken, showToast } from './api.js';

if (getToken()) {
  location.href = '/';
}

let mode = 'login';

const tabs = document.querySelectorAll('.auth-tabs button');
const form = document.getElementById('auth-form');
const submitBtn = document.getElementById('submit-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    mode = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    submitBtn.textContent = mode === 'login' ? '登录' : '注册并登录';
    passwordInput.autocomplete =
      mode === 'login' ? 'current-password' : 'new-password';
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) return;

  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '处理中…';

  try {
    const res =
      mode === 'login'
        ? await api.login(username, password)
        : await api.register(username, password);
    setSession(res.token, res.user);
    showToast(mode === 'login' ? '登录成功' : '注册成功', 'success');
    setTimeout(() => (location.href = '/'), 400);
  } catch (err) {
    showToast(err.message || '操作失败', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});
