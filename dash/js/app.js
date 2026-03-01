/**
 * app.js — Main orchestrator for the EaD Survey Dashboard
 */

import { QUESTIONS, handleFiles, setupUploadZone } from './upload.js';
import { aggregateDiscipline, getConsolidated, getSatisfactionRate,
         getPositiveQuestionsCount, getTotalRespondents,
         getComparisonData, rankDisciplinesBySatisfaction } from './processor.js';
import { renderPieChart, renderBarChart, renderComparisonChart,
         updateAllChartsTheme } from './charts.js';
import { setupFilters, setDiscipline, setQuestion, setView, getState } from './filters.js';
import { setupTheme } from './theme.js';
import { exportAllChartsAsPNG, exportCSV } from './export.js';
import { setupAuth, isLoggedIn, login, logout } from './auth.js';
import { openDB, saveDiscipline, loadAllDisciplines,
         deleteDiscipline, deleteAllDisciplines } from './db.js';

// ---- State ----
const state = {
  disciplines: {},
  activeChartIds: []
};

// ---- DOM Refs ----
const $ = id => document.getElementById(id);

const uploadZone      = $('upload-zone');
const fileInput       = $('file-input');
const guestLock       = $('guest-lock');
const sidebarNav      = $('sidebar-nav');
const disciplineList  = $('discipline-list');
const questionFilter  = $('question-filter');
const emptyState      = $('empty-state');
const emptyMsg        = $('empty-msg');
const emptyHint       = $('empty-hint');
const dashContent     = $('dashboard-content');
const contentTitle    = $('content-title');
const contentSub      = $('content-subtitle');
const chartsGrid      = $('charts-grid');
const compareGrid     = $('compare-grid');
const metricRow       = $('metric-row');
const metricSatVal    = $('metric-sat-value');
const metricBarFill   = $('metric-bar-fill');
const metricRespLoc   = $('metric-resp-local');
const metricPositive  = $('metric-positive');
const statDiscCount   = $('stat-disc-count');
const statRespCount   = $('stat-resp-count');
const btnTheme        = $('btn-theme');
const btnExportCsv    = $('btn-export-csv');
const btnExportPng    = $('btn-export-png');
const toastCont       = $('toast-container');
const btnDeleteAll    = $('btn-delete-all');

// Auth DOM
const loginModal      = $('login-modal');
const loginForm       = $('login-form');
const loginUser       = $('login-user');
const loginPass       = $('login-pass');
const loginError      = $('login-error');
const btnOpenLogin    = $('btn-open-login');
const btnOpenLogin2   = $('btn-open-login-2');
const modalClose      = $('modal-close');
const userChip        = $('user-chip');
const btnLogout       = $('btn-logout');
const btnSubmitLogin  = $('btn-submit-login');
const btnShowPass     = $('btn-show-pass');

// Confirm modal DOM
const confirmModal    = $('confirm-modal');
const confirmTitle    = $('confirm-title');
const confirmMsg      = $('confirm-msg');
const confirmIcon     = $('confirm-icon');
const confirmOk       = $('confirm-ok');
const confirmCancel   = $('confirm-cancel');
const confirmClose    = $('confirm-modal-close');

// =========================================================
// ---- Init ----
// =========================================================

// Populate question filter
QUESTIONS.forEach((q, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = `${i + 1}. ${q.length > 60 ? q.substring(0, 57) + '…' : q}`;
  questionFilter.appendChild(opt);
});

// Theme
setupTheme(btnTheme, () => {
  updateAllChartsTheme();
  rerender(getState());
});

// Auth
setupAuth({ onLogin: () => applyAuthState(true), onLogout: () => applyAuthState(false) });
applyAuthState(isLoggedIn());

// Open IndexedDB, load persisted data, then auto-import any new sample files
(async () => {
  try {
    await openDB();
    await loadPersistedData();
    await loadSampleFiles();
  } catch (err) {
    console.error('[db] Init error:', err);
    toast('Erro ao inicializar o banco de dados local.', 'error');
  }
})();

// =========================================================
// ---- Persistence ----
// =========================================================

async function loadPersistedData() {
  const records = await loadAllDisciplines();
  if (records.length === 0) return;

  for (const record of records) {
    const fakeData = { discipline: record.name, questions: record.questions };
    state.disciplines[record.name] = aggregateDiscipline(fakeData);
  }

  updateTopbarStats();
  renderSidebar();

  const first = Object.keys(state.disciplines)[0];
  if (first) {
    setDiscipline(first);
    sidebarNav.hidden     = false;
    emptyState.hidden     = true;
    dashContent.hidden    = false;
    btnExportCsv.disabled = false;
  }
}

/**
 * Fetch all .json files from the /sample/ directory listing and import
 * any that are not yet persisted in IndexedDB.
 *
 * Works with `npx serve` which returns a JSON directory listing when
 * requested with Accept: application/json.
 */
async function loadSampleFiles() {
  let filenames = [];

  try {
    // npx serve returns JSON listing when Accept: application/json
    const res = await fetch('/sample/', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const data = await res.json();

    // The serve package returns { files: [{base, ext, type}] }
    const entries = data.files ?? data.children ?? [];
    filenames = entries
      .filter(e => e.type === 'file' && (e.ext === 'json' || String(e.base).toLowerCase().endsWith('.json')))
      .map(e => e.base);
  } catch {
    return; // not running under serve or no listing available
  }

  if (filenames.length === 0) return;

  // Find which files are not yet in the DB
  const existing = new Set(Object.keys(state.disciplines));
  const toLoad   = filenames.filter(f => {
    const discName = f.replace(/\.json$/i, '');
    return !existing.has(discName);
  });

  if (toLoad.length === 0) return;

  showSpinner();
  let loaded = 0;
  let errors  = 0;

  try {
    await Promise.all(toLoad.map(async (filename) => {
      try {
        const res  = await fetch(`/sample/${encodeURIComponent(filename)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const { parseJSON } = await import('./upload.js');
        const parsed = parseJSON(text, filename);
        state.disciplines[parsed.discipline] = aggregateDiscipline(parsed);
        await saveDiscipline(parsed.discipline, parsed.questions, parsed.raw);
        loaded++;
      } catch (err) {
        console.warn(`[sample] Failed to load "${filename}":`, err.message);
        errors++;
      }
    }));
  } finally {
    hideSpinner();
  }

  if (loaded === 0) return;

  updateTopbarStats();
  renderSidebar();

  const { activeDiscipline } = getState();
  const first = Object.keys(state.disciplines)[0];

  if (!activeDiscipline && first) {
    setDiscipline(first);
  }

  // Always ensure dashboard is visible and empty state is hidden
  sidebarNav.hidden     = false;
  emptyState.hidden     = true;
  dashContent.hidden    = false;
  btnExportCsv.disabled = false;

  if (activeDiscipline || first) rerender(getState());

  const errStr = errors > 0 ? ` (${errors} com erro)` : '';
  toast(`${loaded} disciplina(s) importada(s) da pasta sample${errStr}.`, 'success');
}

// =========================================================
// ---- Auth UI ----
// =========================================================

function openLoginModal() {
  loginModal.hidden = false;
  loginForm.reset();
  loginError.hidden = true;
  loginUser.focus();
}
function closeLoginModal() {
  loginModal.hidden = true;
  loginPass.type = 'password';
}

function applyAuthState(loggedIn) {
  uploadZone.hidden    = !loggedIn;
  guestLock.hidden     =  loggedIn;
  btnOpenLogin.hidden  =  loggedIn;
  userChip.hidden      = !loggedIn;
  btnDeleteAll.hidden  = !loggedIn;

  if (loggedIn) {
    emptyMsg.innerHTML  = 'Faça o upload de arquivos <code>.json</code> para visualizar os gráficos.';
    emptyHint.hidden    = false;
    emptyHint.textContent = 'Cada arquivo representa uma disciplina. Você pode carregar vários ao mesmo tempo.';
  } else {
    emptyMsg.textContent = 'Você está no modo de visualização. Faça login como administrador para carregar arquivos.';
    emptyHint.hidden    = true;
  }

  // Refresh sidebar to show/hide delete buttons
  if (Object.keys(state.disciplines).length > 0) renderSidebar();
}

btnOpenLogin.addEventListener('click',  openLoginModal);
btnOpenLogin2.addEventListener('click', openLoginModal);
modalClose.addEventListener('click',    closeLoginModal);
loginModal.addEventListener('click', e => { if (e.target === loginModal) closeLoginModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!loginModal.hidden)   closeLoginModal();
    if (!confirmModal.hidden) closeConfirmModal();
  }
});

btnShowPass.addEventListener('click', () => {
  loginPass.type = loginPass.type === 'password' ? 'text' : 'password';
});

btnLogout.addEventListener('click', () => {
  logout();
  toast('Você saiu. Modo de visualização ativado.', 'info');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden       = true;
  btnSubmitLogin.disabled = true;
  btnSubmitLogin.querySelector('.btn-submit-text').hidden   = true;
  btnSubmitLogin.querySelector('.btn-submit-spinner').hidden = false;

  const ok = await login(loginUser.value, loginPass.value);

  btnSubmitLogin.disabled = false;
  btnSubmitLogin.querySelector('.btn-submit-text').hidden   = false;
  btnSubmitLogin.querySelector('.btn-submit-spinner').hidden = true;

  if (ok) { closeLoginModal(); toast('Bem-vindo, Administrador! 👋', 'success'); }
  else    { loginError.hidden = false; loginPass.value = ''; loginPass.focus(); }
});

// =========================================================
// ---- Confirm Modal ----
// =========================================================

let _confirmResolve = null;

function showConfirm({ title, msg, icon = '⚠️' }) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    confirmIcon.textContent  = icon;
    confirmTitle.textContent = title;
    confirmMsg.textContent   = msg;
    confirmModal.hidden = false;
  });
}
function closeConfirmModal(result = false) {
  confirmModal.hidden = true;
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

confirmOk.addEventListener('click',     () => closeConfirmModal(true));
confirmCancel.addEventListener('click', () => closeConfirmModal(false));
confirmClose.addEventListener('click',  () => closeConfirmModal(false));
confirmModal.addEventListener('click',  e => { if (e.target === confirmModal) closeConfirmModal(false); });

// =========================================================
// ---- Delete handlers ----
// =========================================================

btnDeleteAll.addEventListener('click', async () => {
  if (!isLoggedIn()) return;
  const count = Object.keys(state.disciplines).length;
  if (count === 0) return;

  const ok = await showConfirm({
    title: 'Apagar todas as disciplinas?',
    msg: `Todos os ${count} arquivos serão removidos permanentemente do banco local.`,
    icon: '🗑️'
  });
  if (!ok) return;

  await deleteAllDisciplines();
  state.disciplines = {};
  updateTopbarStats();
  disciplineList.innerHTML = '';
  sidebarNav.hidden  = true;
  emptyState.hidden  = false;
  dashContent.hidden = true;
  chartsGrid.innerHTML  = '';
  compareGrid.innerHTML = '';
  btnExportCsv.disabled = true;
  btnDeleteAll.hidden   = true;
  toast('Todas as disciplinas foram apagadas.', 'success');
});

async function handleDeleteDiscipline(name) {
  if (!isLoggedIn()) return;
  const ok = await showConfirm({
    title: `Apagar "${name}"?`,
    msg: 'Esta disciplina e todos os seus dados serão removidos permanentemente.',
    icon: '🗑️'
  });
  if (!ok) return;

  await deleteDiscipline(name);
  delete state.disciplines[name];
  updateTopbarStats();

  const remaining = Object.keys(state.disciplines);
  if (remaining.length === 0) {
    sidebarNav.hidden  = true;
    emptyState.hidden  = false;
    dashContent.hidden = true;
    chartsGrid.innerHTML  = '';
    compareGrid.innerHTML = '';
    btnExportCsv.disabled = true;
    btnDeleteAll.hidden   = true;
  } else {
    renderSidebar();
    // Navigate to another discipline if we deleted the active one
    const { activeDiscipline } = getState();
    if (activeDiscipline === name) setDiscipline(remaining[0]);
    else rerender(getState());
  }

  toast(`"${name}" apagada.`, 'success');
}

// =========================================================
// ---- Upload ----
// =========================================================

setupUploadZone(uploadZone, fileInput, async (files) => {
  if (!isLoggedIn()) {
    toast('Faça login como administrador para carregar arquivos.', 'warning');
    openLoginModal();
    return;
  }

  showSpinner();
  try {
    const { results, errors } = await handleFiles(files);
    errors.forEach(err => toast(err, 'error'));
    if (results.length === 0) { hideSpinner(); return; }

    let addedCount = 0;
    for (const parsed of results) {
      const isNew = !state.disciplines[parsed.discipline];
      state.disciplines[parsed.discipline] = aggregateDiscipline(parsed);
      // Persist raw questions array (not the aggregated form)
      await saveDiscipline(parsed.discipline, parsed.questions, parsed.raw);
      if (isNew) addedCount++;
      else toast(`"${parsed.discipline}" atualizada.`, 'warning');
    }

    if (addedCount > 0) toast(`${addedCount} disciplina(s) carregada(s) e salvas!`, 'success');

    updateTopbarStats();
    renderSidebar();

    const { view, activeDiscipline } = getState();
    if (view === 'individual' && (!activeDiscipline || !state.disciplines[activeDiscipline])) {
      setDiscipline(Object.keys(state.disciplines)[0]);
    } else {
      rerender(getState());
    }

    sidebarNav.hidden  = false;
    emptyState.hidden  = true;
    dashContent.hidden = false;
    btnExportCsv.disabled = false;
    btnDeleteAll.hidden   = !isLoggedIn();
  } finally {
    hideSpinner();
  }
});

// =========================================================
// ---- Filters ----
// =========================================================

setupFilters((filterState) => rerender(filterState));
questionFilter.addEventListener('change', e => setQuestion(e.target.value));
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setView(btn.dataset.view);
  });
});

// =========================================================
// ---- Export ----
// =========================================================

btnExportCsv.addEventListener('click', () => {
  exportCSV(state.disciplines);
  toast('CSV exportado!', 'success');
});
btnExportPng.addEventListener('click', () => {
  if (state.activeChartIds.length === 0) return;
  exportAllChartsAsPNG(state.activeChartIds);
  toast(`Exportando ${state.activeChartIds.length} gráfico(s)…`, 'success');
});

// =========================================================
// ---- Render ----
// =========================================================

function rerender({ view, activeDiscipline, activeQuestion }) {
  state.activeChartIds = [];
  chartsGrid.innerHTML  = '';
  compareGrid.innerHTML = '';
  chartsGrid.hidden  = false;
  compareGrid.hidden = true;
  metricRow.hidden   = false;

  if (Object.keys(state.disciplines).length === 0) return;

  if (view === 'individual') {
    const disc = activeDiscipline || Object.keys(state.disciplines)[0];
    renderIndividual(disc, activeQuestion);
  } else if (view === 'consolidated') {
    renderConsolidated(activeQuestion);
  } else if (view === 'compare') {
    renderComparison(activeQuestion);
  }
}

function renderIndividual(discipline, qFilter) {
  const agg = state.disciplines[discipline];
  if (!agg) return;
  contentTitle.textContent = discipline;
  contentSub.textContent   = 'Visualização individual por disciplina';
  updateMetrics(agg);
  const questions = qFilter === 'all' ? agg : [agg[parseInt(qFilter, 10)]].filter(Boolean);
  questions.forEach(q => renderQuestionCard(q, discipline));
}

function renderConsolidated(qFilter) {
  const merged = getConsolidated(state.disciplines);
  contentTitle.textContent = 'Visão Consolidada';
  contentSub.textContent   = `Dados agregados de ${Object.keys(state.disciplines).length} disciplinas`;
  updateMetrics(merged);
  const questions = qFilter === 'all' ? merged : [merged[parseInt(qFilter, 10)]].filter(Boolean);
  questions.forEach(q => renderQuestionCard(q, 'consolidado'));
}

function renderComparison(qFilter) {
  chartsGrid.hidden  = true;
  compareGrid.hidden = false;
  compareGrid.innerHTML = '';
  metricRow.hidden   = true;
  contentTitle.textContent = 'Comparação entre Disciplinas';
  contentSub.textContent   = 'Visualize respostas lado a lado por pergunta';

  const questions = qFilter === 'all' ? QUESTIONS.map((_, i) => i) : [parseInt(qFilter, 10)];

  questions.forEach(qIdx => {
    const compData = getComparisonData(state.disciplines, qIdx);
    if (!compData.disciplines.length || !compData.series.length) return;

    const card = document.createElement('div');
    card.className = 'compare-card';
    const title = document.createElement('div');
    title.className   = 'compare-card-title';
    title.textContent = `Pergunta ${qIdx + 1}`;
    const sub = document.createElement('div');
    sub.className   = 'compare-card-sub';
    sub.textContent = QUESTIONS[qIdx];
    const containerId = `compare-chart-${qIdx}`;
    const chartDiv = document.createElement('div');
    chartDiv.id = containerId; chartDiv.className = 'chart-container';

    card.appendChild(title); card.appendChild(sub); card.appendChild(chartDiv);
    compareGrid.appendChild(card);
    requestAnimationFrame(() => {
      renderComparisonChart(containerId, compData);
      state.activeChartIds.push(containerId);
    });
  });
}

function renderQuestionCard(qData, disciplineKey) {
  if (!qData || qData.total === 0) return;

  const safeKey = `${disciplineKey.replace(/[^a-z0-9]/gi, '_')}_q${qData.questionIndex}`;
  const pieId   = `pie_${safeKey}`;
  const barId   = `bar_${safeKey}`;

  const card   = document.createElement('div');
  card.className = 'chart-card';
  const header = document.createElement('div');
  header.className = 'chart-card-header';
  const titleBlock = document.createElement('div');
  const qNum = document.createElement('div');
  qNum.className = 'chart-question-num'; qNum.textContent = `Pergunta ${qData.questionIndex}`;
  const qText = document.createElement('div');
  qText.className = 'chart-question-text'; qText.textContent = qData.question;
  titleBlock.appendChild(qNum); titleBlock.appendChild(qText);

  const totalBadge = document.createElement('div');
  totalBadge.className = 'chart-total'; totalBadge.textContent = `${qData.total} resp.`;

  const exportBtn = document.createElement('button');
  exportBtn.className = 'chart-btn-export';
  exportBtn.textContent = '🖼️'; exportBtn.title = 'Exportar como PNG';
  exportBtn.addEventListener('click', () => {
    import('./export.js').then(({ exportAllChartsAsPNG }) => exportAllChartsAsPNG([pieId, barId]));
  });

  header.appendChild(titleBlock); header.appendChild(totalBadge); header.appendChild(exportBtn);

  const pair = document.createElement('div'); pair.className = 'chart-pair';
  const pieDiv = document.createElement('div'); pieDiv.id = pieId; pieDiv.className = 'chart-container';
  const barDiv = document.createElement('div'); barDiv.id = barId; barDiv.className = 'chart-container';
  pair.appendChild(pieDiv); pair.appendChild(barDiv);
  card.appendChild(header); card.appendChild(pair);
  chartsGrid.appendChild(card);

  requestAnimationFrame(() => {
    renderPieChart(pieId, qData);
    renderBarChart(barId, qData);
    state.activeChartIds.push(pieId, barId);
  });
}

function updateMetrics(aggregated) {
  const satRate  = getSatisfactionRate(aggregated);
  const total    = getTotalRespondents(aggregated);
  const posCount = getPositiveQuestionsCount(aggregated);
  metricSatVal.textContent  = `${satRate}%`;
  metricSatVal.className    = 'metric-value ' + satisfactionClass(satRate);
  metricBarFill.style.width = `${satRate}%`;
  metricRespLoc.textContent = total;
  metricPositive.textContent = `${posCount} / 11`;
}

function satisfactionClass(rate) {
  if (rate >= 70) return 'satisfaction-high';
  if (rate >= 40) return 'satisfaction-mid';
  return 'satisfaction-low';
}

function renderSidebar() {
  disciplineList.innerHTML = '';
  const ranking   = rankDisciplinesBySatisfaction(state.disciplines);
  const bestName  = ranking[0]?.name;
  const adminMode = isLoggedIn();
  const { activeDiscipline } = getState();

  // Show/hide the delete-all button
  btnDeleteAll.hidden = !adminMode || ranking.length === 0;

  ranking.forEach(({ name, rate }) => {
    const agg   = state.disciplines[name];
    const total = getTotalRespondents(agg);

    const li = document.createElement('li');
    li.className = 'discipline-item' + (name === activeDiscipline ? ' active' : '');
    li.role = 'option';
    li.setAttribute('aria-selected', name === activeDiscipline);
    li.title = name;

    const dot = document.createElement('span');
    dot.className = 'disc-dot';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    if (name === bestName && ranking.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'best-badge'; badge.textContent = '★';
      badge.title = `Maior satisfação: ${rate}%`;
      nameSpan.appendChild(badge);
    }

    const countSpan = document.createElement('span');
    countSpan.className   = 'disc-count';
    countSpan.textContent = total;

    li.appendChild(dot);
    li.appendChild(nameSpan);
    li.appendChild(countSpan);

    // Delete button (admin only)
    if (adminMode) {
      const delBtn = document.createElement('button');
      delBtn.className   = 'btn-disc-delete';
      delBtn.textContent = '🗑️';
      delBtn.title       = `Apagar "${name}"`;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // don't trigger discipline selection
        handleDeleteDiscipline(name);
      });
      li.appendChild(delBtn);
    }

    li.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      $('view-individual').classList.add('active');
      setView('individual');
      setDiscipline(name);
      document.querySelectorAll('.discipline-item').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
    });

    disciplineList.appendChild(li);
  });
}

function updateTopbarStats() {
  const discCount = Object.keys(state.disciplines).length;
  let totalResp = 0;
  for (const agg of Object.values(state.disciplines)) totalResp += getTotalRespondents(agg);
  statDiscCount.textContent = discCount;
  statRespCount.textContent = totalResp;
}

// ---- Toast ----
function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] ?? 'ℹ️'}</span><span>${message}</span>`;
  toastCont.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut .3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, 4000);
}

// ---- Spinner ----
function showSpinner() {
  if (document.querySelector('.spinner-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'spinner-overlay';
  overlay.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(overlay);
}
function hideSpinner() { document.querySelector('.spinner-overlay')?.remove(); }
