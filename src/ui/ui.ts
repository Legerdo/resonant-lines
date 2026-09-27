// DOM screens: title, pause, death, victory, boss card, settings, records, tuning altar, ending, hints, toasts.
import { el, clear, button, fmtTime, type MenuItem } from './dom.ts';
import { Hud } from './hud.ts';
import { t } from '../localization/ko.ts';
import type { SaveData, Settings } from '../save/save.ts';
import { TUNINGS, MAX_EQUIPPED_TUNINGS, type TuningId } from '../progression/tunings.ts';
import { BOSS_ENTRIES, STORY_BOSSES } from '../bosses/registry.ts';
import { ACTIONS, type Action } from '../input/input.ts';

export interface UiHost {
  continueGame(): void;
  newGame(): void;
  resume(): void;
  retry(): void;
  toHub(): void;
  toTitle(): void;
  replayBoss(id: string): void;
  bossRush(): void;
  toggleTuning(id: TuningId): void;
  applySettings(): void;
  toggleFullscreen(): void;
  endingDone(): void;
  closeMenu(): void;
  rebind(action: Action, code: string): void;
  resetBindings(): void;
  sfx(name: string): void;
  save(): SaveData;
  canRetry(): boolean;
  debugAllowed(): boolean;
}

type ScreenName = 'none' | 'title' | 'pause' | 'death' | 'settings' | 'records' | 'tuning' | 'ending' | 'confirm' | 'victory';

const CAUSE: Record<string, string> = {
  charge: '돌진', ring: '파동', zone: '낙석·충격', projectile: '파편', beam: '광선', slam: '내려찍기', blade: '회전 칼날',
  cut: '절단', eruption: '분출', void: '공허', press: '압박', jet: '물줄기', contact: '접촉', shard: '파편', sweep: '휩쓸기',
};

export class UI {
  readonly root: HTMLElement;
  readonly hud = new Hud();
  private screenEl = el('div', 'screen hidden');
  private hint = el('div', 'hint-bar px-frame hidden');
  private prompt = el('div', 'prompt hidden');
  private toastEl = el('div', 'toast px-frame hidden');
  private bossCard = el('div', 'boss-card hidden');
  private fadeEl = el('div', 'fade');
  readonly debugPanel = el('div', 'debug-panel hidden');
  private toastT = 0;
  private bossCardT = 0;
  screen: ScreenName = 'none';
  private back: ScreenName = 'none';
  private host: UiHost;
  private focusIdx = 0;
  private rebinding: Action | null = null;

  constructor(root: HTMLElement, host: UiHost) {
    this.root = root;
    this.host = host;
    root.append(this.hud.root, this.hint, this.prompt, this.toastEl, this.bossCard, this.screenEl, this.debugPanel, this.fadeEl);
    this.hud.root.classList.add('hidden');
  }

  get menuOpen(): boolean {
    return this.screen !== 'none';
  }

  // ------------------------------------------------------------------ generic
  private buttons(): HTMLButtonElement[] {
    return Array.from(this.screenEl.querySelectorAll<HTMLButtonElement>('button.btn:not([disabled])'));
  }

  private show(name: ScreenName, content: HTMLElement, cls = 'dim'): void {
    this.screen = name;
    clear(this.screenEl);
    this.screenEl.className = `screen ${cls}`;
    this.screenEl.dataset.screen = name;
    this.screenEl.appendChild(content);
    this.focusIdx = 0;
    this.applyFocus();
  }

  hideScreen(): void {
    this.screen = 'none';
    this.screenEl.className = 'screen hidden';
    this.screenEl.dataset.screen = 'none';
    clear(this.screenEl);
  }

  private applyFocus(): void {
    const bs = this.buttons();
    bs.forEach((b, i) => b.classList.toggle('focus', i === this.focusIdx));
    bs[this.focusIdx]?.focus({ preventScroll: true });
  }

  /** keyboard / gamepad menu navigation. returns true if consumed */
  navigate(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean {
    if (!this.menuOpen) return false;
    const bs = this.buttons();
    if (dir === 'up' || dir === 'left') this.focusIdx = (this.focusIdx - 1 + bs.length) % Math.max(1, bs.length);
    if (dir === 'down' || dir === 'right') this.focusIdx = (this.focusIdx + 1) % Math.max(1, bs.length);
    if (dir === 'ok') {
      bs[this.focusIdx]?.click();
      return true;
    }
    if (dir === 'back') {
      this.goBack();
      return true;
    }
    this.host.sfx('uiMove');
    this.applyFocus();
    return true;
  }

  goBack(): void {
    this.host.sfx('uiBack');
    if (this.screen === 'settings' || this.screen === 'records' || this.screen === 'confirm') {
      if (this.back === 'title') this.showTitle();
      else if (this.back === 'pause') this.showPause();
      else {
        this.hideScreen();
        this.host.closeMenu();
      }
    } else if (this.screen === 'tuning') {
      this.hideScreen();
      this.host.closeMenu();
    } else if (this.screen === 'pause') this.host.resume();
  }

  private menu(title: string, items: MenuItem[], extra?: HTMLElement): HTMLElement {
    const m = el('div', 'menu px-frame interactive');
    if (title) m.appendChild(el('h2', '', title));
    if (extra) m.appendChild(extra);
    for (const it of items) {
      const act = it.action;
      m.appendChild(button({ ...it, action: act ? () => { this.host.sfx('ui'); act(); } : undefined } as MenuItem));
    }
    return m;
  }

  // ------------------------------------------------------------------ screens
  showTitle(): void {
    this.back = 'title';
    const wrap = el('div', 'screen');
    wrap.style.position = 'relative';
    const logo = el('div', 'title-logo', t('game.title'));
    const sub = el('div', 'title-sub', t('game.subtitle'));
    const en = el('div', 'title-en', 'RESONANT LINES · SEALED HEARTS');
    const hasSave = this.host.save().flags.length > 0 || this.host.save().discoveredBossIds.length > 0;
    const m = this.menu('', [
      { label: t('menu.continue'), action: () => this.host.continueGame(), disabled: !hasSave, id: 'continue' },
      { label: t('menu.newGame'), action: () => (hasSave ? this.showConfirmNew() : this.host.newGame()), id: 'new' },
      { label: t('menu.records'), action: () => this.showRecords(false), id: 'records' },
      { label: t('menu.settings'), action: () => this.showSettings('title'), id: 'settings' },
    ]);
    wrap.append(logo, sub, en, m);
    this.show('title', wrap, '');
    if (!hasSave) {
      this.focusIdx = 0;
      this.applyFocus();
    }
  }

  private showConfirmNew(): void {
    this.back = 'title';
    const m = this.menu(t('menu.newGame'), [
      { label: t('menu.no'), action: () => this.showTitle(), id: 'no' },
      { label: t('menu.yes'), action: () => this.host.newGame(), id: 'yes' },
    ], el('p', 'small', t('menu.confirmNew')));
    this.show('confirm', m);
  }

  showPause(): void {
    this.back = 'pause';
    const items: MenuItem[] = [{ label: t('menu.resume'), action: () => this.host.resume(), id: 'resume' }];
    if (this.host.canRetry()) items.push({ label: t('menu.retry'), action: () => this.host.retry(), id: 'retry' });
    items.push(
      { label: t('menu.settings'), action: () => this.showSettings('pause'), id: 'settings' },
      { label: t('menu.toHub'), action: () => this.host.toHub(), id: 'hub' },
      { label: t('menu.toTitle'), action: () => this.host.toTitle(), id: 'title' },
    );
    this.show('pause', this.menu(t('menu.paused'), items));
  }

  showDeath(cause: string): void {
    const w = el('div', 'screen death interactive');
    w.appendChild(el('div', 'big', t('death.title')));
    const why = CAUSE[cause];
    if (why) w.appendChild(el('div', 'why', `— ${why} —`));
    const keys = el('div', 'keys');
    const r = el('span');
    r.append(el('b', '', '[R] '), document.createTextNode(t('death.retry')));
    const e = el('span');
    e.append(el('b', '', '[Esc] '), document.createTextNode(t('death.toHub')));
    keys.append(r, e);
    w.appendChild(keys);
    const m = this.menu('', [
      { label: t('death.retry'), action: () => this.host.retry(), id: 'retry', hint: 'R' },
      { label: t('death.toHub'), action: () => this.host.toHub(), id: 'hub', hint: 'Esc' },
    ]);
    m.style.minWidth = 'auto';
    w.appendChild(m);
    this.show('death', w, 'dim');
  }

  showVictory(bossId: string, time: number, newBest: boolean, tuning: TuningId | null, gate: boolean): void {
    const w = el('div', 'toast px-frame');
    w.style.position = 'static';
    w.style.transform = 'none';
    w.appendChild(el('div', 'big', t('boss.defeated')));
    w.appendChild(el('div', 'sub', t(`boss.${bossId}`)));
    w.appendChild(el('div', 'small', `${t('boss.time')} ${fmtTime(time)}${newBest ? ` · ${t('boss.newBest')}` : ''}`));
    if (tuning) w.appendChild(el('div', 'sub', `${t('boss.tuningUnlocked')}: ${t(`tuning.${tuning}`)}`));
    if (gate) w.appendChild(el('div', 'sub', t('heart.opened')));
    this.show('victory', w, '');
  }

  showSettings(from: ScreenName): void {
    this.back = from;
    const s = this.host.save().settings;
    const box = el('div', 'panel px-frame interactive');
    box.appendChild(el('h2', 'accent', t('settings.title')));
    const grid = el('div', 'setting');
    const slider = (label: string, get: () => number, set: (v: number) => void, min = 0, max = 1, step = 0.05) => {
      grid.appendChild(el('span', '', label));
      const r = el('input', 'slider interactive');
      r.type = 'range';
      r.min = String(min);
      r.max = String(max);
      r.step = String(step);
      r.value = String(get());
      r.setAttribute('aria-label', label);
      r.addEventListener('input', () => {
        set(Number(r.value));
        this.host.applySettings();
      });
      grid.appendChild(r);
    };
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void, id: string) => {
      const b = button({ label, value: get() ? t('settings.on') : t('settings.off'), id, action: () => {
        set(!get());
        this.host.applySettings();
        (b.querySelector('.val') as HTMLElement).textContent = get() ? t('settings.on') : t('settings.off');
      } });
      grid.appendChild(b);
      grid.appendChild(el('span'));
    };
    const vol = s.volume;
    grid.appendChild(el('b', 'accent', t('settings.audio')));
    grid.appendChild(el('span'));
    slider(t('settings.master'), () => vol.master, (v) => (vol.master = v));
    slider(t('settings.music'), () => vol.music, (v) => (vol.music = v));
    slider(t('settings.boss'), () => vol.boss, (v) => (vol.boss = v));
    slider(t('settings.resonance'), () => vol.resonance, (v) => (vol.resonance = v));
    slider(t('settings.impact'), () => vol.impact, (v) => (vol.impact = v));
    slider(t('settings.environment'), () => vol.environment, (v) => (vol.environment = v));
    slider(t('settings.ui'), () => vol.ui, (v) => (vol.ui = v));
    grid.appendChild(el('b', 'accent', t('settings.display')));
    grid.appendChild(el('span'));
    const scaleBtn = button({ label: t('settings.uiScale'), value: `${Math.round(s.uiScale * 100)}%`, id: 'uiScale', action: () => {
      s.uiScale = s.uiScale === 1 ? 1.25 : s.uiScale === 1.25 ? 1.5 : 1;
      this.host.applySettings();
      (scaleBtn.querySelector('.val') as HTMLElement).textContent = `${Math.round(s.uiScale * 100)}%`;
    } });
    grid.append(scaleBtn, el('span'));
    slider(t('settings.shake'), () => s.shake, (v) => (s.shake = v));
    toggle(t('settings.flash'), () => s.flash, (v) => (s.flash = v), 'flash');
    toggle(t('settings.highContrast'), () => s.highContrast, (v) => (s.highContrast = v), 'contrast');
    toggle(t('settings.slowMode'), () => s.slowMode, (v) => (s.slowMode = v), 'slow');
    grid.append(button({ label: t('settings.fullscreen'), id: 'fullscreen', action: () => this.host.toggleFullscreen() }), el('span'));
    grid.appendChild(el('b', 'accent', t('settings.controls')));
    grid.appendChild(el('span'));
    slider(t('settings.aimSensitivity'), () => s.aimSensitivity, (v) => (s.aimSensitivity = v), 0.5, 2, 0.1);
    slider(t('settings.deadzone'), () => s.deadzone, (v) => (s.deadzone = v), 0.05, 0.5, 0.01);
    toggle(t('settings.vibration'), () => s.vibration, (v) => (s.vibration = v), 'vibration');
    const binds = this.host.save().bindings;
    for (const a of ACTIONS) {
      const b = button({ label: t(`action.${a}`), value: binds[a].map(keyName).join(' / '), id: `bind-${a}`, action: () => {
        this.rebinding = a;
        (b.querySelector('.val') as HTMLElement).textContent = t('settings.pressKey');
      } });
      grid.append(b, el('span'));
    }
    grid.append(button({ label: t('settings.resetKeys'), id: 'resetKeys', action: () => { this.host.resetBindings(); this.showSettings(from); } }), el('span'));
    box.appendChild(grid);
    box.appendChild(button({ label: t('menu.back'), id: 'back', action: () => this.goBack() }));
    this.show('settings', box);
  }

  /** intercept key presses while waiting for a rebind */
  captureRebind(code: string): boolean {
    if (!this.rebinding) return false;
    const a = this.rebinding;
    this.rebinding = null;
    if (code !== 'Escape') this.host.rebind(a, code);
    this.showSettings(this.back);
    return true;
  }

  showRecords(fromDevice: boolean): void {
    this.back = fromDevice ? 'none' : 'title';
    const save = this.host.save();
    const box = el('div', 'panel px-frame interactive');
    box.appendChild(el('h2', 'accent', t('records.title')));
    const table = el('table');
    const head = el('tr');
    head.append(el('th', '', ''), el('th', 'num', t('records.best')), el('th', 'num', t('records.deaths')));
    table.appendChild(head);
    for (const b of BOSS_ENTRIES) {
      const seen = save.discoveredBossIds.includes(b.id) || save.completedBossIds.includes(b.id);
      const tr = el('tr');
      tr.append(el('td', '', seen ? t(b.nameKey) : '???'), el('td', 'num', fmtTime(save.bossBestTimes[b.id])), el('td', 'num', String(save.bossDeathCounts[b.id] ?? 0)));
      table.appendChild(tr);
    }
    const fc = el('tr');
    fc.append(el('td', 'accent', t('records.fullClear')), el('td', 'num', fmtTime(save.fullClearBestTime)), el('td'));
    table.appendChild(fc);
    box.appendChild(table);
    if (fromDevice) {
      box.appendChild(el('p', 'small', t('records.replayHint')));
      const done = BOSS_ENTRIES.filter((b) => save.completedBossIds.includes(b.id));
      for (const b of done) box.appendChild(button({ label: `${t('menu.replay')}: ${t(b.nameKey)}`, id: `replay-${b.id}`, action: () => this.host.replayBoss(b.id) }));
      const allStory = STORY_BOSSES.every((id) => save.completedBossIds.includes(id));
      box.appendChild(button({ label: t('menu.rush'), id: 'rush', disabled: !allStory, action: () => this.host.bossRush() }));
    }
    box.appendChild(button({ label: t('menu.back'), id: 'back', action: () => this.goBack() }));
    this.show('records', box);
  }

  showTuning(): void {
    this.back = 'none';
    const save = this.host.save();
    const box = el('div', 'panel px-frame interactive');
    box.appendChild(el('h2', 'accent', t('menu.tuning')));
    box.appendChild(el('p', 'small', `${t('tuning.slots')} (${save.equippedTunings.length}/${MAX_EQUIPPED_TUNINGS})`));
    for (const tu of TUNINGS) {
      const unlocked = save.unlockedTunings.includes(tu.id);
      const on = save.equippedTunings.includes(tu.id);
      const b = button({
        label: unlocked ? t(tu.nameKey) : `${t('tuning.locked')}`,
        value: unlocked ? (on ? t('tuning.equipped') : '') : '',
        hint: unlocked ? t(tu.descKey) : '',
        disabled: !unlocked,
        id: `tuning-${tu.id}`,
        action: () => {
          this.host.toggleTuning(tu.id);
          this.showTuning();
        },
      });
      box.appendChild(b);
    }
    box.appendChild(button({ label: t('menu.close'), id: 'back', action: () => this.goBack() }));
    this.show('tuning', box);
  }

  showEnding(): void {
    const w = el('div', 'screen ending solid interactive');
    const l1 = el('div', 'line', t('ending.1'));
    const l2 = el('div', 'line', t('ending.2'));
    const end = el('div', 'title-logo', t('ending.end'));
    const thanks = el('div', 'small', t('ending.thanks'));
    const m = this.menu('', [{ label: t('ending.toTitle'), action: () => this.host.endingDone(), id: 'toTitle' }]);
    for (const [i, e] of [l1, l2, end, thanks, m].entries()) {
      e.style.opacity = '0';
      e.style.transition = 'opacity 1.2s linear';
      setTimeout(() => (e.style.opacity = '1'), 600 + i * 1400);
    }
    w.append(l1, l2, end, thanks, m);
    this.show('ending', w, 'solid');
  }

  // ------------------------------------------------------------------ transient overlays
  setHint(text: string | null): void {
    if (!text) {
      this.hint.classList.add('hidden');
      return;
    }
    this.hint.classList.remove('hidden');
    if (this.hint.textContent !== text) this.hint.textContent = text;
  }

  setPrompt(text: string | null): void {
    this.prompt.classList.toggle('hidden', !text);
    if (text && this.prompt.textContent !== text) this.prompt.textContent = text;
  }

  toast(big: string, sub = '', secs = 2.2): void {
    clear(this.toastEl);
    this.toastEl.appendChild(el('div', 'big', big));
    if (sub) this.toastEl.appendChild(el('div', 'sub', sub));
    this.toastEl.classList.remove('hidden');
    this.toastT = secs;
  }

  showBossCard(name: string, secs = 1.6): void {
    clear(this.bossCard);
    this.bossCard.append(el('div', 'line'), el('div', 'big', name), el('div', 'line'));
    this.bossCard.classList.remove('hidden');
    this.bossCardT = secs;
  }

  setFade(on: boolean): void {
    this.fadeEl.classList.toggle('on', on);
  }

  tick(dt: number): void {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.add('hidden');
    }
    if (this.bossCardT > 0) {
      this.bossCardT -= dt;
      if (this.bossCardT <= 0) this.bossCard.classList.add('hidden');
    }
  }

  setHudVisible(v: boolean): void {
    this.hud.root.classList.toggle('hidden', !v);
  }
}

export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift', ShiftRight: 'Shift', Space: 'Space', Escape: 'Esc', ControlLeft: 'Ctrl', AltLeft: 'Alt', Tab: 'Tab', Enter: 'Enter' };
  return map[code] ?? code;
}

export type { Settings };
