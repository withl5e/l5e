// Counts executions so a duplicated <script> tag would be observable from the
// page, not just from the HTML source.
const w = window as unknown as { __dedupeRuns?: number };
w.__dedupeRuns = (w.__dedupeRuns ?? 0) + 1;

document.querySelectorAll('[data-dedupe-card]').forEach((el) => {
  el.textContent = `client js runs: ${w.__dedupeRuns}`;
});
