import { api, requireAuth, logout, getUser, showToast } from './api.js';

requireAuth();

const state = {
  words: [],
  total: 0,
  filter: 'all',
  search: '',
  editingId: null,
  pageNum: 1,
  pageSize: 10,
  loading: false,
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
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');
const userLabel = document.getElementById('user-label');
const user = getUser();
if (user) userLabel.textContent = user.username;

document.getElementById('logout-btn').addEventListener('click', logout);

document.querySelectorAll('#list-filter button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.value;
    state.pageNum = 1;
    document
      .querySelectorAll('#list-filter button')
      .forEach((b) => b.classList.toggle('active', b === btn));
    load();
  });
});

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.pageNum = 1;
    load();
  }, 300);
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
      await api.updateWord(state.editingId, payload);
      showToast('已更新', 'success');
    } else {
      await api.createWord(payload);
      state.pageNum = 1;
      showToast('已添加', 'success');
    }
    resetForm();
    load();
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
  resetBtn.classList.add('hidden');
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
  resetBtn.classList.remove('hidden');
  wordInput.focus();
  wordInput.select();
}

async function toggleKnown(id) {
  const w = state.words.find((x) => x.id === id);
  if (!w) return;
  try {
    await api.setKnown(id, !w.known);
    showToast(w.known ? '已标为未会' : '已标为已会', 'success');
    load();
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
    if (state.editingId === id) resetForm();
    // 如果删除了当前页的最后一条且不是第一页，回退一页
    if (state.words.length === 1 && state.pageNum > 1) {
      state.pageNum -= 1;
    }
    showToast('已删除', 'success');
    load();
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
  const items = state.words;
  const total = state.total;

  countEl.textContent = `共 ${total} 条`;

  if (!items.length) {
    listBody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-400 py-8">暂无数据</td></tr>`;
    renderPagination(total, 0, 0);
    return;
  }

  const from = (state.pageNum - 1) * state.pageSize + 1;
  const to = from + items.length - 1;

  listBody.innerHTML = items
    .map(
      (w) => `
        <tr data-id="${w.id}" class="hover:bg-indigo-500/5">
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle"><strong>${escapeHtml(w.word)}</strong></td>
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle">${escapeHtml(w.translation || '—')}</td>
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle">${w.weight}</td>
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle">
            <span class="inline-block py-0.5 px-2 rounded-xl text-xs border ${w.known ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-pink-400/10 border-pink-400 text-pink-400'}">
              ${w.known ? '已会' : '未会'}
            </span>
          </td>
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle">
            <div class="flex gap-1.5">
              <button class="ghost text-xs py-1 px-2.5 whitespace-nowrap" data-act="toggle">${
                w.known ? '标为未会' : '标为已会'
              }</button>
              <button class="ghost text-xs py-1 px-2.5 whitespace-nowrap" data-act="edit">编辑</button>
              <button class="danger text-xs py-1 px-2.5 whitespace-nowrap" data-act="delete">删除</button>
            </div>
          </td>
        </tr>`
    )
    .join('');
  renderPagination(total, from, to);
}

function renderPagination(total, from, to) {
  if (!paginationEl) return;
  if (total <= state.pageSize) {
    paginationEl.innerHTML = total
      ? `<span>显示 ${from}-${to} / ${total}</span>`
      : '';
    return;
  }

  const totalPages = Math.ceil(total / state.pageSize);
  paginationEl.innerHTML = `
    <span>显示 ${from}-${to} / ${total}</span>
    <div class="flex items-center gap-2">
      <button class="ghost text-xs py-1.5 px-3" data-page-act="prev" ${state.pageNum === 1 ? 'disabled' : ''}>上一页</button>
      <span class="text-slate-300">第 ${state.pageNum} / ${totalPages} 页</span>
      <button class="ghost text-xs py-1.5 px-3" data-page-act="next" ${state.pageNum === totalPages ? 'disabled' : ''}>下一页</button>
    </div>
  `;
}

paginationEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-page-act]');
  if (!btn) return;
  if (btn.dataset.pageAct === 'prev') state.pageNum -= 1;
  if (btn.dataset.pageAct === 'next') state.pageNum += 1;
  load();
});

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

function showLoading() {
  listBody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-400 py-8"><span class="loading-spinner"></span>加载中…</td></tr>`;
}

async function load() {
  if (state.loading) return;
  state.loading = true;
  showLoading();
  try {
    const params = { pageSize: state.pageSize, pageNum: state.pageNum };
    if (state.filter === 'known') params.known = 'true';
    else if (state.filter === 'unknown') params.known = 'false';
    if (state.search) params.search = state.search;
    const res = await api.listWords(params);
    state.words = res.items || [];
    state.total = res.total || 0;
    renderList();
  } catch (err) {
    showToast(err.message || '加载失败', 'error');
  } finally {
    state.loading = false;
  }
}

load();
