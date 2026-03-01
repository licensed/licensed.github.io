/**
 * processor.js
 * Aggregates raw parsed data into chart-ready structures.
 */

import { QUESTIONS } from './upload.js';

// Answer labels considered "positive" for satisfaction calculation
const POSITIVE_ANSWERS = new Set([
  'sim', 'yes', 'sempre', 'ótimo', 'otimo', 'bom', 'boa',
  'muito bom', 'muito boa', 'excelente', 'satisfeito', 'satisfeita',
  'concordo', 'totalmente', 'suficiente', 'contribuiu', 'presentes',
  'atendidas', 'atingidos', 'ajudou', 'ajudou muito', 'contribuiu muito',
  'esclareceu', 'esclareceram'
]);

/**
 * Aggregate answers for a single discipline.
 * Returns an array of 11 items, one per question.
 * Each item: { question, answers: {[label]: count}, total, percentages: {[label]: pct} }
 */
export function aggregateDiscipline(parsedData) {
  return parsedData.questions.map((answers, i) => {
    const counts = {};
    for (const a of answers) {
      const key = a.trim();
      counts[key] = (counts[key] || 0) + 1;
    }
    const total = answers.length;
    const percentages = {};
    for (const [k, v] of Object.entries(counts)) {
      percentages[k] = total > 0 ? Math.round((v / total) * 1000) / 10 : 0;
    }
    return {
      question: QUESTIONS[i],
      questionIndex: i + 1,
      answers: counts,
      percentages,
      total,
      rawAnswers: answers
    };
  });
}

/**
 * Compute satisfaction rate for an aggregated discipline.
 * Returns a number 0–100 representing % of positive-ish answers.
 */
export function getSatisfactionRate(aggregated) {
  let positiveCount = 0;
  let totalCount = 0;
  for (const q of aggregated) {
    for (const [label, count] of Object.entries(q.answers)) {
      totalCount += count;
      if (isPositive(label)) positiveCount += count;
    }
  }
  return totalCount > 0 ? Math.round((positiveCount / totalCount) * 1000) / 10 : 0;
}

/**
 * Count questions where the majority answer is positive.
 */
export function getPositiveQuestionsCount(aggregated) {
  let count = 0;
  for (const q of aggregated) {
    if (q.total === 0) continue;
    const topAnswer = Object.entries(q.answers).sort((a, b) => b[1] - a[1])[0];
    if (topAnswer && isPositive(topAnswer[0])) count++;
  }
  return count;
}

/**
 * Merge all disciplines into a consolidated dataset.
 */
export function getConsolidated(allDisciplines) {
  // allDisciplines: { [name]: aggregated[] }
  const merged = QUESTIONS.map((q, i) => ({
    question: q,
    questionIndex: i + 1,
    answers: {},
    percentages: {},
    total: 0,
    rawAnswers: []
  }));

  for (const aggregated of Object.values(allDisciplines)) {
    for (let i = 0; i < 11; i++) {
      const q = aggregated[i];
      if (!q) continue;
      merged[i].total += q.total;
      merged[i].rawAnswers.push(...q.rawAnswers);
      for (const [label, count] of Object.entries(q.answers)) {
        merged[i].answers[label] = (merged[i].answers[label] || 0) + count;
      }
    }
  }

  // Recompute percentages
  for (const q of merged) {
    for (const [label, count] of Object.entries(q.answers)) {
      q.percentages[label] = q.total > 0 ? Math.round((count / q.total) * 1000) / 10 : 0;
    }
  }

  return merged;
}

export function isPositive(label) {
  return POSITIVE_ANSWERS.has(label.toLowerCase().trim());
}

/**
 * Get total respondents for a discipline (max answers across all questions)
 */
export function getTotalRespondents(aggregated) {
  return Math.max(...aggregated.map(q => q.total), 0);
}

/**
 * Build comparison data for a specific question across all disciplines.
 * Returns { disciplines: string[], series: { label, values: number[] }[] }
 */
export function getComparisonData(allDisciplines, questionIndex) {
  const disciplines = Object.keys(allDisciplines);
  // Collect all unique answer labels across disciplines for this question
  const labelSet = new Set();
  for (const agg of Object.values(allDisciplines)) {
    const q = agg[questionIndex];
    if (q) Object.keys(q.answers).forEach(l => labelSet.add(l));
  }
  const labels = Array.from(labelSet);

  const series = labels.map(label => ({
    label,
    values: disciplines.map(d => {
      const q = allDisciplines[d][questionIndex];
      return q ? (q.answers[label] || 0) : 0;
    }),
    percentages: disciplines.map(d => {
      const q = allDisciplines[d][questionIndex];
      return q ? (q.percentages[label] || 0) : 0;
    })
  }));

  return { disciplines, series };
}

/** Sort discipline names by satisfaction rate descending */
export function rankDisciplinesBySatisfaction(allDisciplines) {
  return Object.entries(allDisciplines)
    .map(([name, agg]) => ({ name, rate: getSatisfactionRate(agg) }))
    .sort((a, b) => b.rate - a.rate);
}
