// Theme toggle. The initial data-theme is set by the inline script in
// index.html before paint; this only handles the click-to-flip + persistence.
const STORAGE_KEY = 'theme';

function current(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage disabled — the toggle still works for this session.
  }
}

document.addEventListener('click', (event) => {
  const toggle = (event.target as HTMLElement | null)?.closest('[data-theme-toggle]');
  if (!toggle) return;
  apply(current() === 'dark' ? 'light' : 'dark');
});
