import { api, requireAuth, logout, getUser, showToast } from './api.js';

requireAuth();

const KNOWN_COLORS = ['#475569', '#64748b', '#94a3b8'];
const UNKNOWN_COLORS = [
  '#f472b6',
  '#a855f7',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
];

const state = {
  words: [],
  displayField: 'word',
  filter: 'all',
  dimKnown: true,
};

const canvas = document.getElementById('cloud-canvas');
const wrap = document.getElementById('cloud');
const tooltip = document.getElementById('cloud-tooltip');
const emptyTip = document.getElementById('empty-tip');
const userLabel = document.getElementById('user-label');
const user = getUser();
if (user) userLabel.textContent = user.username;

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('refresh-btn').addEventListener('click', loadAndRender);
document.getElementById('goto-manage').addEventListener('click', () => {
  location.href = '/manage.html';
});

document.querySelectorAll('#display-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.displayField = btn.dataset.value;
    document.querySelectorAll('#display-toggle button').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
    render();
  });
});

document.querySelectorAll('#filter-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.value;
    document.querySelectorAll('#filter-toggle button').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
    render();
  });
});

document.getElementById('dim-known').addEventListener('change', (e) => {
  state.dimKnown = e.target.checked;
  render();
});

function resizeCanvas() {
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}

function pickColor(known) {
  const pool = known ? KNOWN_COLORS : UNKNOWN_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildList() {
  let items = state.words.slice();
  if (state.filter === 'known') items = items.filter((w) => w.known);
  if (state.filter === 'unknown') items = items.filter((w) => !w.known);

  return items
    .map((w) => {
      const text =
        state.displayField === 'translation'
          ? w.translation || w.word
          : w.word;
      if (!text) return null;
      let weight = Math.max(1, Math.min(100, w.weight || 1));
      if (state.dimKnown && w.known) weight = Math.max(1, weight * 0.6);
      // extra: [known, originalWord, translation]
      return [text, weight, w.known, w.word, w.translation];
    })
    .filter(Boolean);
}

function render() {
  if (typeof WordCloud === 'undefined') {
    showToast('词云脚本加载失败，请检查网络', 'error');
    return;
  }
  resizeCanvas();
  const list = buildList();
  emptyTip.style.display = list.length ? 'none' : 'flex';
  if (!list.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const maxWeight = list.reduce((m, x) => Math.max(m, x[1]), 1);
  const baseSize = Math.min(canvas.width, canvas.height) / 12;

  function showTooltip(text, x, y) {
    if (!text) return;
    tooltip.textContent = text;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.classList.add('show');
  }

  function hideTooltip() {
    tooltip.classList.remove('show');
  }

  WordCloud(canvas, {
    list,
    gridSize: Math.round(8 * (canvas.width / 1024)),
    weightFactor: (w) => (w / maxWeight) * baseSize + 12,
    fontFamily:
      '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    fontWeight: '600',
    color: (_word, _weight, _fontSize, _distance, _theta, extra) => {
      const known = extra && extra[0];
      return pickColor(!!known);
    },
    backgroundColor: '#0f172a',
    rotateRatio: 0.25,
    rotationSteps: 2,
    minRotation: -Math.PI / 6,
    maxRotation: Math.PI / 6,
    shuffle: true,
    drawOutOfBound: false,
    shrinkToFit: true,
    minSize: 8,
    hover: (item, _dim, event) => {
      if (!item) {
        hideTooltip();
        return;
      }
      // item: [displayText, weight, known, originalWord, translation]
      const originalWord = item[3];
      const translation = item[4];
      const displayText = item[0];
      let tipText = '';
      if (state.displayField === 'word') {
        // showing original words — hover shows translation
        tipText = translation || '';
      } else {
        // showing translations — hover shows original word
        tipText = originalWord !== displayText ? originalWord : '';
      }
      if (tipText) {
        showTooltip(tipText, event.clientX + 14, event.clientY - 36);
      } else {
        hideTooltip();
      }
    },
  });

  // Follow cursor when tooltip is visible; hide on leave
  tooltipMoveHandler = (e) => {
    if (tooltip.classList.contains('show')) {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY - 36) + 'px';
    }
  };
  canvas.addEventListener('mousemove', tooltipMoveHandler);

  canvas.removeEventListener('mouseleave', hideTooltip);
  canvas.addEventListener('mouseleave', hideTooltip);
}

let tooltipMoveHandler = null;

async function loadAndRender() {
  try {
    const res = await api.listWords();
    state.words = res.items || [];
    render();
  } catch (err) {
    showToast(err.message || '加载失败', 'error');
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 200);
});

loadAndRender();
