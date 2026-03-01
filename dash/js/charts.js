/**
 * charts.js
 * Plotly.js chart rendering: pie, bar (horizontal), comparison grouped bar.
 */

import { isDark } from './theme.js';

/** Palette for answer labels (consistent across charts) */
const PALETTE = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16', '#a78bfa', '#fb923c'
];

function getPlotlyLayout(isDarkMode, extra = {}) {
  const paper = isDarkMode ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0)';
  const font  = isDarkMode ? '#e8e6ff' : '#1a1a2e';
  const grid  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return {
    paper_bgcolor: paper,
    plot_bgcolor: paper,
    font: { family: 'Inter, system-ui, sans-serif', color: font, size: 12 },
    margin: { t: 10, r: 10, b: 10, l: 10 },
    showlegend: true,
    legend: {
      orientation: 'h',
      x: 0, y: -0.12,
      font: { size: 11, color: font },
      bgcolor: 'rgba(0,0,0,0)'
    },
    xaxis: { gridcolor: grid, zerolinecolor: grid, tickfont: { color: font } },
    yaxis: { gridcolor: grid, zerolinecolor: grid, tickfont: { color: font } },
    hoverlabel: {
      bgcolor: isDarkMode ? '#1c1a30' : '#fff',
      bordercolor: isDarkMode ? '#2a2848' : '#e4e4f0',
      font: { color: font, size: 12, family: 'Inter, system-ui, sans-serif' }
    },
    ...extra
  };
}

const CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
  toImageButtonOptions: { format: 'png', scale: 2 }
};

/**
 * Render a pie chart.
 * @param {string} containerId — DOM element id
 * @param {{ answers: {[k]:number}, percentages: {[k]:number}, total: number }} qData
 */
export function renderPieChart(containerId, qData) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const labels = Object.keys(qData.answers);
  const values = Object.values(qData.answers);

  const trace = {
    type: 'pie',
    labels,
    values,
    hole: 0.38,
    pull: labels.map(() => 0.02),
    marker: {
      colors: labels.map((_, i) => PALETTE[i % PALETTE.length]),
      line: { color: isDark() ? '#0f0e1a' : '#fff', width: 2 }
    },
    textinfo: 'percent',
    textposition: 'inside',
    insidetextorientation: 'radial',
    hovertemplate: '<b>%{label}</b><br>Qtd: %{value}<br>%{percent}<extra></extra>',
    direction: 'clockwise',
    sort: false
  };

  Plotly.newPlot(el, [trace], {
    ...getPlotlyLayout(isDark()),
    margin: { t: 10, r: 10, b: 60, l: 10 },
    height: 250
  }, CONFIG);
}

/**
 * Render a horizontal bar chart.
 * @param {string} containerId
 * @param {{ answers: {[k]:number}, percentages: {[k]:number}, total: number }} qData
 */
export function renderBarChart(containerId, qData) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const labels = Object.keys(qData.answers);
  const values = Object.values(qData.answers);
  const pcts   = labels.map(l => qData.percentages[l] || 0);
  const total  = qData.total;

  const trace = {
    type: 'bar',
    x: values,
    y: labels,
    orientation: 'h',
    marker: {
      color: labels.map((_, i) => PALETTE[i % PALETTE.length]),
      line: { color: 'transparent', width: 0 }
    },
    text: pcts.map(p => `${p}%`),
    textposition: 'outside',
    cliponaxis: false,
    hovertemplate: '<b>%{y}</b><br>Qtd: %{x} de ' + total + '<br>%{text}<extra></extra>',
    width: labels.map(() => Math.min(0.55, 0.85 - labels.length * 0.04))
  };

  const maxVal = Math.max(...values, 1);

  Plotly.newPlot(el, [trace], {
    ...getPlotlyLayout(isDark(), {
      xaxis: { range: [0, maxVal * 1.3], showgrid: true, zeroline: false },
      yaxis: { automargin: true, zeroline: false }
    }),
    margin: { t: 10, r: 40, b: 30, l: 12 },
    height: 250,
    showlegend: false
  }, CONFIG);
}

/**
 * Render a grouped bar chart for comparison across disciplines.
 * @param {string} containerId
 * @param {{ disciplines: string[], series: { label, values, percentages }[] }} compData
 */
export function renderComparisonChart(containerId, compData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const dark = isDark();

  const traces = compData.series.map((s, i) => ({
    type: 'bar',
    name: s.label,
    x: compData.disciplines,
    y: s.values,
    marker: { color: PALETTE[i % PALETTE.length] },
    text: s.percentages.map(p => `${p}%`),
    textposition: 'outside',
    cliponaxis: false,
    hovertemplate: `<b>${s.label}</b><br>%{x}: %{y} resp. (%{text})<extra></extra>`
  }));

  const layout = {
    ...getPlotlyLayout(dark, { barmode: 'group' }),
    margin: { t: 20, r: 20, b: 80, l: 40 },
    height: 320,
    xaxis: { tickangle: -25, automargin: true },
    legend: { orientation: 'h', x: 0, y: -0.3 }
  };

  Plotly.newPlot(el, traces, layout, CONFIG);
}

/** Re-apply theme to all existing Plotly charts */
export function updateAllChartsTheme() {
  const dark = isDark();
  const paper = 'rgba(0,0,0,0)';
  const font  = dark ? '#e8e6ff' : '#1a1a2e';
  const grid  = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  const update = {
    paper_bgcolor: paper,
    plot_bgcolor: paper,
    'font.color': font,
    'xaxis.gridcolor': grid,
    'yaxis.gridcolor': grid,
    'legend.font.color': font
  };

  document.querySelectorAll('.chart-container').forEach(el => {
    if (el._fullLayout) {
      Plotly.relayout(el, update).catch(() => {});
    }
  });
}

/** Export a single chart container as PNG */
export function exportChartPNG(containerId, filename) {
  const el = document.getElementById(containerId);
  if (!el || !el._fullLayout) return;
  Plotly.downloadImage(el, { format: 'png', width: 900, height: 500, filename });
}
