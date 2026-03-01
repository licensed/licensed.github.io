/**
 * theme.js
 * Dark/light theme toggle with localStorage persistence.
 */

const STORAGE_KEY = 'ead-dashboard-theme';
const ROOT = document.documentElement;

let currentTheme = localStorage.getItem(STORAGE_KEY) || 'light';
applyTheme(currentTheme);

export function setupTheme(btnEl, onThemeChange) {
  btnEl.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    localStorage.setItem(STORAGE_KEY, currentTheme);
    if (onThemeChange) onThemeChange(currentTheme);
  });
}

export function applyTheme(theme) {
  ROOT.setAttribute('data-theme', theme);
  currentTheme = theme;
}

export function getTheme() {
  return currentTheme;
}

export function isDark() {
  return currentTheme === 'dark';
}
