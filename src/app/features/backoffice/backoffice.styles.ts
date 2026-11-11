/**
 * Common styles of the backoffice pages (header, filter bar, states).
 * They are shared as component `styles` so as not to grow the register's global CSS.
 */
export const BO_PAGE_STYLES = `
  :host { display: block; padding: 20px max(16px, env(safe-area-inset-right, 0px)) 24px max(16px, env(safe-area-inset-left, 0px)); }
  .head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .head h1 { font-size: 24px; margin: 0; }
  .head p { margin: 4px 0 0; color: var(--muted); font-size: 14px; max-width: 65ch; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-bottom: 14px; }
  .toolbar select { width: auto; min-height: 40px; }
  .state { padding: 28px 12px; text-align: center; color: var(--muted); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .pos { color: var(--ok); }
  .neg { color: var(--err); }
  .pager { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 10px; font-size: 13px; color: var(--muted); }
  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; align-items: start; }
  form.card { display: grid; gap: 2px; }
  form.card h2 { font-size: 16px; }
`;
