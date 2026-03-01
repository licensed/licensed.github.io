/**
 * filters.js
 * Simple filter state management.
 */

let state = {
  activeDiscipline: null,  // null = no selection
  activeQuestion: 'all',   // 'all' or questionIndex (0-based)
  view: 'individual'        // 'individual' | 'consolidated' | 'compare'
};

let changeCallback = null;

export function setupFilters(onFilterChange) {
  changeCallback = onFilterChange;
}

export function setDiscipline(name) {
  state.activeDiscipline = name;
  notify();
}

export function setQuestion(value) {
  state.activeQuestion = value;
  notify();
}

export function setView(view) {
  state.view = view;
  notify();
}

export function getState() {
  return { ...state };
}

function notify() {
  if (changeCallback) changeCallback({ ...state });
}
