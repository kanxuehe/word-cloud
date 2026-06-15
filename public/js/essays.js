import { api, requireAuth, logout, getUser, showToast } from './api.js';

requireAuth();

const state = {
  essays: [],
  total: 0,
  editingId: null,
  pageNum: 1,
  pageSize: 10,
  loading: false,
  viewingId: null,
};

// 表单元素
const form = document.getElementById('essay-form');
const formTitle = document.getElementById('form-title');
const idInput = document.getElementById('essay-id');
const titleInput = document.getElementById('essay-title');
const originalInput = document.getElementById('essay-original');
const translationInput = document.getElementById('essay-translation');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const listBody = document.getElementById('essay-list');
const countEl = document.getElementById('count');
const paginationEl = document.getElementById('pagination');

// 弹窗元素
const modal = document.getElementById('view-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalOriginal = document.getElementById('modal-original');
const modalTranslation = document.getElementById('modal-translation');
const toggleTranslation = document.getElementById('toggle-translation');
const modalEditBtn = document.getElementById('modal-edit-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTranslateBtn = document.getElementById('modal-translate-btn');
const modalTranslateStatus = document.getElementById('modal-translate-status');

// 用户标签
const userLabel = document.getElementById('user-label');
const user = getUser();
if (user) userLabel.textContent = user.username;

document.getElementById('logout-btn').addEventListener('click', logout);

// 刷新按钮
document.getElementById('refresh-btn').addEventListener('click', () => load());

// 表单内 AI 翻译按钮
const formTranslateBtn = document.getElementById('form-translate-btn');
formTranslateBtn.addEventListener('click', async () => {
  const text = originalInput.value.trim();
  if (!text) {
    showToast('请先填写原文', 'error');
    return;
  }
  formTranslateBtn.disabled = true;
  formTranslateBtn.textContent = '翻译中…';
  try {
    const result = await api.translateText(text);
    translationInput.value = result.translationText;
    showToast('翻译完成', 'success');
  } catch (err) {
    showToast(err.message || '翻译失败', 'error');
  } finally {
    formTranslateBtn.disabled = false;
    formTranslateBtn.textContent = '🤖 AI 翻译';
  }
});

// 取消编辑
resetBtn.addEventListener('click', resetForm);

// 表单提交
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: titleInput.value.trim(),
    originalText: originalInput.value.trim(),
    translationText: translationInput.value.trim(),
  };
  if (!payload.title) {
    showToast('请填写标题', 'error');
    return;
  }
  if (!payload.originalText) {
    showToast('请填写原文', 'error');
    return;
  }
  submitBtn.disabled = true;
  try {
    if (state.editingId) {
      await api.updateEssay(state.editingId, payload);
      showToast('已更新', 'success');
    } else {
      await api.createEssay(payload);
      state.pageNum = 1;
      showToast('已录入', 'success');
    }
    resetForm();
    load();
  } catch (err) {
    showToast(err.message || '保存失败', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// 列表点击事件委托
listBody.addEventListener('click', (e) => {
  // 点击标题 → 打开弹窗
  const titleLink = e.target.closest('.essay-title-link');
  if (titleLink) {
    const row = titleLink.closest('tr[data-id]');
    if (row) openView(row.dataset.id);
    return;
  }
  // 操作按钮
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('tr[data-id]');
  if (!row) return;
  const id = row.dataset.id;
  const act = btn.dataset.act;
  if (act === 'edit') startEdit(id);
  else if (act === 'delete') removeEssay(id);
});

// 分页点击
paginationEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-page-act]');
  if (!btn) return;
  if (btn.dataset.pageAct === 'prev') state.pageNum -= 1;
  if (btn.dataset.pageAct === 'next') state.pageNum += 1;
  load();
});

// ===== 弹窗逻辑 =====

// 显示/隐藏译文
toggleTranslation.addEventListener('change', () => {
  if (toggleTranslation.checked) {
    modalBody.classList.add('split');
  } else {
    modalBody.classList.remove('split');
  }
});

// 关闭弹窗
function closeModal() {
  modal.classList.remove('open');
  state.viewingId = null;
  toggleTranslation.checked = false;
  modalBody.classList.remove('split');
  modalTranslateStatus.textContent = '';
}
modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// 弹窗内编辑按钮
modalEditBtn.addEventListener('click', () => {
  if (state.viewingId) {
    startEdit(state.viewingId);
    closeModal();
  }
});

// AI 翻译按钮
modalTranslateBtn.addEventListener('click', async () => {
  if (!state.viewingId) return;
  modalTranslateBtn.disabled = true;
  modalTranslateStatus.textContent = '翻译中…';
  try {
    const updated = await api.translateEssay(state.viewingId);
    modalTranslation.textContent = updated.translationText || '（译文为空）';
    toggleTranslation.checked = true;
    modalBody.classList.add('split');
    modalTranslateStatus.textContent = '翻译完成';
    // 同步更新列表缓存
    const idx = state.essays.findIndex((e) => e.id === state.viewingId);
    if (idx !== -1) {
      state.essays[idx].translationText = updated.translationText;
    }
    showToast('AI 翻译完成', 'success');
  } catch (err) {
    modalTranslateStatus.textContent = '翻译失败';
    showToast(err.message || '翻译失败', 'error');
  } finally {
    modalTranslateBtn.disabled = false;
  }
});

// ===== 弹窗：查看 =====
function openView(id) {
  const essay = state.essays.find((e) => e.id === id);
  if (!essay) return;
  state.viewingId = id;
  modalTitle.textContent = essay.title;
  modalOriginal.textContent = essay.originalText;
  modalTranslation.textContent = essay.translationText || '（暂无译文，点击下方「AI 翻译」生成）';
  toggleTranslation.checked = false;
  modalBody.classList.remove('split');
  modalTranslateStatus.textContent = '';
  modal.classList.add('open');
}

// ===== 表单操作 =====

function resetForm() {
  state.editingId = null;
  idInput.value = '';
  titleInput.value = '';
  originalInput.value = '';
  translationInput.value = '';
  formTitle.textContent = '录入短文';
  submitBtn.textContent = '录入';
  resetBtn.classList.add('hidden');
  titleInput.focus();
}

function startEdit(id) {
  const essay = state.essays.find((e) => e.id === id);
  if (!essay) return;
  state.editingId = id;
  idInput.value = id;
  titleInput.value = essay.title;
  originalInput.value = essay.originalText;
  translationInput.value = essay.translationText || '';
  formTitle.textContent = '编辑短文';
  submitBtn.textContent = '保存修改';
  resetBtn.classList.remove('hidden');
  titleInput.focus();
  titleInput.select();
  // 滚动到表单
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function removeEssay(id) {
  const essay = state.essays.find((e) => e.id === id);
  if (!essay) return;
  if (!confirm(`确认删除"${essay.title}"？`)) return;
  try {
    await api.deleteEssay(id);
    if (state.editingId === id) resetForm();
    if (state.essays.length === 1 && state.pageNum > 1) {
      state.pageNum -= 1;
    }
    showToast('已删除', 'success');
    load();
  } catch (err) {
    showToast(err.message || '删除失败', 'error');
  }
}

// ===== 列表渲染 =====

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderList() {
  const items = state.essays;
  const total = state.total;

  countEl.textContent = `共 ${total} 条`;

  if (!items.length) {
    listBody.innerHTML = `<tr><td colspan="3" class="text-center text-slate-400 py-8">暂无数据</td></tr>`;
    renderPagination(total, 0, 0);
    return;
  }

  const from = (state.pageNum - 1) * state.pageSize + 1;
  const to = from + items.length - 1;

  listBody.innerHTML = items
    .map(
      (e) => `
        <tr data-id="${e.id}" class="hover:bg-indigo-500/5">
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle">
            <span class="essay-title-link">${escapeHtml(e.title)}</span>
          </td>
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle">
            <span class="inline-block py-0.5 px-2 rounded-xl text-xs border ${e.translationText ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-slate-500/10 border-slate-600 text-slate-400'}">
              ${e.translationText ? '已翻译' : '未翻译'}
            </span>
          </td>
          <td class="text-left py-[10px] px-3 border-b border-slate-700 align-middle">
            <div class="flex gap-1.5">
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

function showLoading() {
  listBody.innerHTML = `<tr><td colspan="3" class="text-center text-slate-400 py-8"><span class="loading-spinner"></span>加载中…</td></tr>`;
}

async function load() {
  if (state.loading) return;
  state.loading = true;
  showLoading();
  try {
    const params = { pageSize: state.pageSize, pageNum: state.pageNum };
    const res = await api.listEssays(params);
    state.essays = res.items || [];
    state.total = res.total || 0;
    renderList();
  } catch (err) {
    showToast(err.message || '加载失败', 'error');
  } finally {
    state.loading = false;
  }
}

load();
