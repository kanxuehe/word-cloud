import { api, requireAuth, logout, getUser, showToast } from './api.js';

requireAuth();

const state = {
  words: [],
  filter: 'all',
  editingId: null,
};

const form = document.getElementById('word-form');
const formTitle = document.getElementById('form-title');
const idInput = document.getElementById('word-id');
const wordInput = document.getElementById('word');
const translationInput = document.getElementById('translation');
const weightInput = document.getElementById('weight');
const knownInput = document.getElementById('known');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const listBody = document.getElementById('word-list');
const countEl = document.getElementById('count');
const userLabel = document.getElementById('user-label');
const user = getUser();
if (user) userLabel.textContent = user.username;

document.getElementById('logout-btn').addEventListener('click', logout);

document.querySelectorAll('#list-filter button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.value;
    document
      .querySelectorAll('#list-filter button')
      .forEach((b) => b.classList.toggle('active', b === btn));
    renderList();
  });
});

resetBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    word: wordInput.value.trim(),
    translation: translationInput.value.trim(),
    weight: Number(weightInput.value) || 1,
    known: knownInput.checked,
  };
  if (!payload.word) {
    showToast('请填写原词', 'error');
    return;
  }
  submitBtn.disabled = true;
  try {
    if (state.editingId) {
      const updated = await api.updateWord(state.editingId, payload);
      const idx = state.words.findIndex((w) => w.id === updated.id);
      if (idx >= 0) state.words[idx] = updated;
      showToast('已更新', 'success');
    } else {
      const created = await api.createWord(payload);
      state.words.unshift(created);
      showToast('已添加', 'success');
    }
    resetForm();
    renderList();
  } catch (err) {
    showToast(err.message || '保存失败', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

function resetForm() {
  state.editingId = null;
  idInput.value = '';
  wordInput.value = '';
  translationInput.value = '';
  weightInput.value = '1';
  knownInput.checked = false;
  formTitle.textContent = '添加新单词';
  submitBtn.textContent = '添加';
  resetBtn.style.display = 'none';
  wordInput.focus();
}

function startEdit(id) {
  const w = state.words.find((x) => x.id === id);
  if (!w) return;
  state.editingId = id;
  idInput.value = id;
  wordInput.value = w.word;
  translationInput.value = w.translation || '';
  weightInput.value = w.weight || 1;
  knownInput.checked = !!w.known;
  formTitle.textContent = '编辑单词';
  submitBtn.textContent = '保存修改';
  resetBtn.style.display = '';
  wordInput.focus();
  wordInput.select();
}

async function toggleKnown(id) {
  const w = state.words.find((x) => x.id === id);
  if (!w) return;
  try {
    const updated = await api.setKnown(id, !w.known);
    const idx = state.words.findIndex((x) => x.id === id);
    if (idx >= 0) state.words[idx] = updated;
    renderList();
  } catch (err) {
    showToast(err.message || '操作失败', 'error');
  }
}

async function removeWord(id) {
  const w = state.words.find((x) => x.id === id);
  if (!w) return;
  if (!confirm(`确认删除"${w.word}"？`)) return;
  try {
    await api.deleteWord(id);
    state.words = state.words.filter((x) => x.id !== id);
    if (state.editingId === id) resetForm();
    showToast('已删除', 'success');
    renderList();
  } catch (err) {
    showToast(err.message || '删除失败', 'error');
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderList() {
  let items = state.words;
  if (state.filter === 'known') items = items.filter((w) => w.known);
  if (state.filter === 'unknown') items = items.filter((w) => !w.known);

  countEl.textContent = `共 ${state.words.length} 条，未会 ${
    state.words.filter((w) => !w.known).length
  }`;

  if (!items.length) {
    listBody.innerHTML = `<tr><td colspan="5" class="empty-row">暂无数据</td></tr>`;
    return;
  }

  listBody.innerHTML = items
    .map(
      (w) => `
        <tr data-id="${w.id}">
          <td><strong>${escapeHtml(w.word)}</strong></td>
          <td>${escapeHtml(w.translation || '—')}</td>
          <td>${w.weight}</td>
          <td>
            <span class="tag ${w.known ? 'known' : 'unknown'}">
              ${w.known ? '已会' : '未会'}
            </span>
          </td>
          <td>
            <div class="row-actions">
              <button class="ghost" data-act="toggle">${
                w.known ? '标为未会' : '标为已会'
              }</button>
              <button class="ghost" data-act="edit">编辑</button>
              <button class="danger" data-act="delete">删除</button>
            </div>
          </td>
        </tr>`
    )
    .join('');
}

listBody.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('tr[data-id]');
  if (!row) return;
  const id = row.dataset.id;
  const act = btn.dataset.act;
  if (act === 'toggle') toggleKnown(id);
  else if (act === 'edit') startEdit(id);
  else if (act === 'delete') removeWord(id);
});

async function load() {
  try {
    const res = await api.listWords();
    state.words = res.items || [];
    renderList();
  } catch (err) {
    showToast(err.message || '加载失败', 'error');
  }
}

load();
