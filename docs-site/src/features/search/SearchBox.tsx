export function SearchBox() {
  return (
    <div class="search-box">
      <div class="search-box__field">
        <span class="search-box__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </span>
        <input
          id="docs-search-input"
          class="search-box__input"
          type="search"
          placeholder="Search the docs…"
          autocomplete="off"
          aria-label="Search the documentation"
        />
        <span class="search-box__kbd" aria-hidden="true">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </div>
      <div
        id="docs-search-results"
        class="search-box__results"
        role="region"
        aria-live="polite"
        aria-label="Search results"
      />
    </div>
  );
}
