export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function clear(e: HTMLElement): void {
  while (e.firstChild) e.removeChild(e.firstChild);
}

export interface MenuItem {
  label: string;
  action?: () => void;
  disabled?: boolean;
  value?: string;
  hint?: string;
  id?: string;
}

export function button(item: MenuItem): HTMLButtonElement {
  const b = el('button', 'btn interactive');
  b.type = 'button';
  const span = el('span', '', item.label);
  b.appendChild(span);
  if (item.value !== undefined) b.appendChild(el('span', 'val', item.value));
  if (item.hint !== undefined) b.appendChild(el('span', 'hint', item.hint));
  if (item.id) b.dataset.id = item.id;
  if (item.disabled) b.disabled = true;
  if (item.action && !item.disabled) {
    const act = item.action;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      act();
    });
  }
  return b;
}

export function fmtTime(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
