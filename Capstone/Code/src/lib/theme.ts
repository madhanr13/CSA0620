type Theme = 'light' | 'dark';
const system = window.matchMedia('(prefers-color-scheme: dark)');
let saved: string | null = null;
try { saved = localStorage.getItem('circuit-theme'); } catch { /* Storage can be unavailable in private contexts. */ }
let theme: Theme = saved === 'light' || saved === 'dark' ? saved : system.matches ? 'dark' : 'light';
let explicit = saved === 'light' || saved === 'dark';
function apply() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#17191c' : '#ffffff');
  const button = document.getElementById('theme-toggle');
  if (button) {
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}
apply();
system.addEventListener('change', event => {
  if (!explicit) { theme = event.matches ? 'dark' : 'light'; apply(); }
});
export function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  explicit = true;
  try { localStorage.setItem('circuit-theme', theme); } catch { /* Keep the session preference without storage. */ }
  apply();
}
export function isDark() { return theme === 'dark'; }
