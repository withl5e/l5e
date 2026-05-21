import { createSwap } from '@withl5e/l5e/swap';

import { searchDocs } from '~/views/docs/actions';

const DEBOUNCE_MS = 150;

const input = document.getElementById('docs-search-input') as HTMLInputElement | null;
if (input) {
  let timer: number | null = null;
  input.addEventListener('input', () => {
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => {
      input.dispatchEvent(new CustomEvent('docs-search', { bubbles: true }));
    }, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      input.dispatchEvent(new CustomEvent('docs-search', { bubbles: true }));
      input.blur();
    }
  });

  // Global hotkeys: "/" (no modifier), Ctrl+K, Cmd+K — focus the search input.
  // "/" is skipped when the user is already typing in a field; Ctrl/Cmd+K wins
  // anywhere so it's always reachable.
  document.addEventListener('keydown', (event) => {
    const isModK =
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      (event.key === 'k' || event.key === 'K');

    const isSlash =
      event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;

    if (!isModK && !isSlash) return;

    if (isSlash) {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || active?.isContentEditable) return;
    }

    event.preventDefault();
    input.focus();
    input.select();
  });

  // Click outside collapses the dropdown by clearing the input
  document.addEventListener('click', (event) => {
    const wrapper = input.closest('.search-box');
    if (!wrapper) return;
    if (!wrapper.contains(event.target as Node) && input.value !== '') {
      input.value = '';
      input.dispatchEvent(new CustomEvent('docs-search', { bubbles: true }));
    }
  });
}

createSwap({
  trigger: '#docs-search-input',
  event: 'docs-search',
  target: '#docs-search-results',
  swap: 'innerHTML',
  action: (ctx) =>
    searchDocs({
      q: (ctx.triggerElement as HTMLInputElement | null)?.value ?? '',
    }),
});
