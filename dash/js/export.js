/**
 * export.js
 * PNG bulk export and CSV export of the consolidated summary.
 */

import { QUESTIONS } from './upload.js';
import { exportChartPNG } from './charts.js';

/**
 * Export all visible pie+bar charts as PNG files.
 * @param {string[]} chartIds — list of chart container element IDs
 */
export function exportAllChartsAsPNG(chartIds) {
  chartIds.forEach((id, i) => {
    setTimeout(() => {
      const filename = `grafico_${String(i + 1).padStart(2, '0')}_${id.replace(/[^a-z0-9]/gi, '_')}`;
      exportChartPNG(id, filename);
    }, i * 400); // stagger downloads slightly
  });
}

/**
 * Export a CSV summary of all disciplines and questions.
 * @param {{ [discipline: string]: Array<{question, answers, percentages, total}> }} allDisciplines
 */
export function exportCSV(allDisciplines) {
  const disciplines = Object.keys(allDisciplines);
  if (disciplines.length === 0) return;

  const rows = [];

  // Header
  const header = ['Disciplina', 'Nº Pergunta', 'Pergunta', 'Total Respondentes', 'Resposta', 'Quantidade', 'Percentual (%)'];
  rows.push(header.map(csvQuote).join(','));

  for (const disc of disciplines) {
    const aggregated = allDisciplines[disc];
    for (const q of aggregated) {
      for (const [label, count] of Object.entries(q.answers)) {
        rows.push([
          csvQuote(disc),
          q.questionIndex,
          csvQuote(q.question),
          q.total,
          csvQuote(label),
          count,
          csvQuote(String(q.percentages[label] ?? 0) + '%')
        ].join(','));
      }
    }
  }

  const csvContent = '\uFEFF' + rows.join('\n'); // BOM for Excel UTF-8 compat
  downloadText(csvContent, 'avaliacao_disciplinas.csv', 'text/csv;charset=utf-8;');
}

/**
 * Export a compact metrics summary CSV.
 * @param {Array<{name, rate}>} ranking
 * @param {{ [discipline: string]: Array }} allDisciplines
 */
export function exportMetricsCSV(ranking, allDisciplines) {
  const rows = [];
  rows.push(['Disciplina', 'Taxa de Satisfação (%)', 'Total Respondentes'].map(csvQuote).join(','));
  for (const { name, rate } of ranking) {
    const agg = allDisciplines[name];
    const total = agg ? Math.max(...agg.map(q => q.total), 0) : 0;
    rows.push([csvQuote(name), rate, total].join(','));
  }
  const csv = '\uFEFF' + rows.join('\n');
  downloadText(csv, 'metricas_satisfacao.csv', 'text/csv;charset=utf-8;');
}

function csvQuote(str) {
  const s = String(str);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}
