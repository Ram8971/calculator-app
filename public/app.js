/* ─────────────────────────────────────────────────────────────
   CalcX – Full Stack Calculator Frontend Logic
   Communicates with Express API at /api/calculate & /api/history
───────────────────────────────────────────────────────────── */

const API_BASE = '/api';

// ─── State ────────────────────────────────────────────────────
const state = {
  expression: '',       // raw expression string
  displayExpr: '',      // what's shown in the top line
  displayResult: '0',   // main display number
  justEvaluated: false, // did we just press '='?
  activeOp: null,       // which operator button is "lit"
  loading: false,
};

// ─── DOM Refs ─────────────────────────────────────────────────
const elExpr    = document.getElementById('display-expression');
const elResult  = document.getElementById('display-result');
const elStatus  = document.getElementById('display-status');
const elHistory = document.getElementById('history-list');
const elEmpty   = document.getElementById('history-empty');

// ─── Render ───────────────────────────────────────────────────
function render() {
  elExpr.textContent   = state.displayExpr;
  elResult.textContent = state.displayResult;
}

function popResult() {
  elResult.classList.remove('pop');
  void elResult.offsetWidth; // force reflow
  elResult.classList.add('pop');
}

function setStatus(msg, isError = false) {
  elStatus.textContent = msg;
  elStatus.style.color = isError ? 'var(--text-error)' : 'var(--text-dim)';
}

function clearStatus() { elStatus.textContent = ''; }

function highlightOp(op) {
  document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active'));
  if (op) {
    const btn = document.querySelector(`.btn-op[data-value="${CSS.escape(op)}"]`);
    if (btn) btn.classList.add('active');
  }
  state.activeOp = op;
}

// ─── Input Logic ──────────────────────────────────────────────
function appendToExpression(val) {
  if (state.justEvaluated) {
    // If last action was '=', continue with result OR start fresh
    const ops = ['+', '-', '*', '/', '^'];
    if (ops.includes(val)) {
      // Continue from result
      state.expression = state.displayResult + val;
    } else {
      // Start fresh
      state.expression = val;
    }
    state.justEvaluated = false;
  } else {
    state.expression += val;
  }
  state.displayExpr   = state.expression;
  state.displayResult = state.expression || '0';
  highlightOp(null);
  clearStatus();
  render();
}

function handleDigit(val) {
  appendToExpression(val);
}

function handleOperator(op) {
  if (!state.expression && state.displayResult !== '0') {
    state.expression = state.displayResult;
  }
  // Replace trailing operator if any
  state.expression = state.expression.replace(/[+\-*/^]$/, '');
  if (!state.expression) {
    state.expression = '0';
  }
  state.expression   += op;
  state.displayExpr   = state.expression;
  state.displayResult = state.expression;
  state.justEvaluated = false;
  highlightOp(op);
  clearStatus();
  render();
}

function handleDot() {
  // Prevent multiple dots in the current number segment
  const segments = state.expression.split(/[+\-*/^()]/);
  const lastSeg  = segments[segments.length - 1];
  if (lastSeg.includes('.')) return;

  const val = state.expression === '' || state.justEvaluated ? '0.' : '.';
  if (state.justEvaluated) {
    state.expression    = '0.';
    state.justEvaluated = false;
  } else {
    state.expression += '.';
  }
  state.displayExpr   = state.expression;
  state.displayResult = state.expression;
  clearStatus();
  render();
}

function handlePercent() {
  if (!state.expression) return;
  try {
    // evaluate the expression so far / 100
    const val = parseFloat(state.expression) / 100;
    if (!isNaN(val)) {
      state.expression    = String(val);
      state.displayExpr   = state.expression;
      state.displayResult = state.expression;
      clearStatus();
      render();
    }
  } catch (_) {}
}

function handleSign() {
  if (!state.expression || state.expression === '0') return;
  if (state.expression.startsWith('-')) {
    state.expression = state.expression.slice(1);
  } else {
    state.expression = '-' + state.expression;
  }
  state.displayExpr   = state.expression;
  state.displayResult = state.expression;
  render();
}

function handleClear() {
  state.expression    = '';
  state.displayExpr   = '';
  state.displayResult = '0';
  state.justEvaluated = false;
  highlightOp(null);
  clearStatus();
  render();
}

function handleBackspace() {
  if (state.justEvaluated) { handleClear(); return; }
  state.expression    = state.expression.slice(0, -1);
  state.displayExpr   = state.expression;
  state.displayResult = state.expression || '0';
  highlightOp(null);
  render();
}

// ─── API Call ─────────────────────────────────────────────────
async function handleEquals() {
  const expr = state.expression.trim();
  if (!expr) return;

  setStatus('');

  // Show loading indicator
  elResult.innerHTML = `<span class="loading-dots"><span></span><span></span><span></span></span>`;
  state.loading = true;

  try {
    const res  = await fetch(`${API_BASE}/calculate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ expression: expr }),
    });
    const data = await res.json();

    if (!res.ok) {
      state.displayResult = 'Error';
      elResult.textContent = 'Error';
      setStatus(data.error || 'Calculation failed', true);
    } else {
      const resultStr = formatResult(data.result);
      state.displayExpr   = expr + ' =';
      state.displayResult = resultStr;
      state.expression    = resultStr;
      state.justEvaluated = true;
      highlightOp(null);
      render();
      popResult();
      clearStatus();
      // Refresh history from server
      await loadHistory();
    }
  } catch (err) {
    state.displayResult  = 'Error';
    elResult.textContent = 'Error';
    setStatus('Server unreachable', true);
  } finally {
    state.loading = false;
  }
}

function formatResult(num) {
  if (Number.isInteger(num)) return String(num);
  // trim trailing zeros
  return parseFloat(num.toFixed(10)).toString();
}

// ─── History ──────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res  = await fetch(`${API_BASE}/history`);
    const data = await res.json();
    renderHistory(data);
  } catch (_) {}
}

function renderHistory(items) {
  // Remove all existing history items (keep the empty placeholder)
  document.querySelectorAll('.history-item').forEach(el => el.remove());

  if (!items || items.length === 0) {
    elEmpty.style.display = 'flex';
    return;
  }
  elEmpty.style.display = 'none';

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.setAttribute('role', 'listitem');
    li.setAttribute('title', 'Click to reuse');
    li.innerHTML = `
      <div class="history-expr">${escapeHtml(item.expression)}</div>
      <div class="history-res">= ${escapeHtml(String(item.result))}</div>
      <div class="history-time">${formatTime(item.timestamp)}</div>
    `;
    li.addEventListener('click', () => {
      state.expression    = String(item.result);
      state.displayExpr   = item.expression + ' =';
      state.displayResult = String(item.result);
      state.justEvaluated = true;
      highlightOp(null);
      clearStatus();
      render();
      popResult();
    });
    elHistory.appendChild(li);
  });
}

async function clearHistory() {
  try {
    await fetch(`${API_BASE}/history`, { method: 'DELETE' });
    renderHistory([]);
  } catch (_) {}
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Button Click Delegation ──────────────────────────────────
document.querySelector('.btn-grid').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || state.loading) return;
  dispatch(btn.dataset.action, btn.dataset.value);
});

document.querySelector('.extra-ops').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || state.loading) return;
  dispatch(btn.dataset.action, btn.dataset.value);
});

document.getElementById('btn-clear-history').addEventListener('click', clearHistory);

function dispatch(action, value) {
  switch (action) {
    case 'digit':    handleDigit(value);    break;
    case 'operator': handleOperator(value); break;
    case 'dot':      handleDot();           break;
    case 'percent':  handlePercent();       break;
    case 'sign':     handleSign();          break;
    case 'clear':    handleClear();         break;
    case 'backspace':handleBackspace();     break;
    case 'equals':   handleEquals();        break;
  }
}

// ─── Keyboard Support ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (state.loading) return;
  const key = e.key;

  if (key >= '0' && key <= '9') return dispatch('digit', key);
  if (key === '.') return dispatch('dot');
  if (key === '+') return dispatch('operator', '+');
  if (key === '-') return dispatch('operator', '-');
  if (key === '*') return dispatch('operator', '*');
  if (key === '/') { e.preventDefault(); return dispatch('operator', '/'); }
  if (key === '^') return dispatch('operator', '^');
  if (key === '(' || key === ')') return dispatch('digit', key);
  if (key === '%') return dispatch('percent');
  if (key === 'Enter' || key === '=') { e.preventDefault(); return dispatch('equals'); }
  if (key === 'Backspace') return dispatch('backspace');
  if (key === 'Escape') return dispatch('clear');

  // Highlight the key's button briefly
  highlightKeyBtn(key);
});

function highlightKeyBtn(key) {
  const map = {
    '+': '#btn-add', '-': '#btn-subtract', '*': '#btn-multiply',
    '/': '#btn-divide', '=': '#btn-equals', 'Enter': '#btn-equals',
    'Escape': '#btn-clear', 'Backspace': '#btn-backspace',
  };
  const sel = map[key] || (key >= '0' && key <= '9' ? `#btn-${key}` : null);
  if (!sel) return;
  const el = document.querySelector(sel);
  if (el) {
    el.style.transform = 'scale(0.92)';
    setTimeout(() => { el.style.transform = ''; }, 120);
  }
}

// ─── Init ─────────────────────────────────────────────────────
loadHistory();
