// Combat/exploration HUD. Shows Shield/Core, needles, link charge, pulse readiness and seal glyphs.
// Never shows HP bars, damage numbers, percentages or solution markers.
import { el } from './dom.ts';
import { icon, setIcon } from './uiArt.ts';
import { t } from '../localization/ko.ts';
import type { Sim } from '../core/sim/sim.ts';
import { fmtTime } from './dom.ts';
import { planPulse } from '../resonance/pulse.ts';

const STATE_KEY: Record<string, string> = {
  Held: '손', Flying: '비행', EmbeddedWorld: '고정', EmbeddedBoss: '부착', Disabled: '무력', Returning: '회수',
};
const LINK_KEY: Record<string, string> = { Idle: 'combat.idle', Charging: 'combat.charging', Charged: 'combat.charged', Overloaded: 'combat.overloaded', Broken: 'combat.broken' };
const SIG_ICON: Record<string, string> = { Impact: 'sigImpact', Wave: 'sigWave', Heat: 'sigHeat', Void: 'sigVoid', Rotational: 'sigRotational' };

export class Hud {
  readonly root = el('div', 'hud');
  private shield = el('div', 'hud-shield');
  private shieldIcons: HTMLSpanElement[] = [];
  private shieldLabel = el('span', 'label');
  private boss = el('div', 'hud-boss');
  private bossName = el('div', 'name');
  private seals = el('div', 'seals');
  private needles = el('div', 'hud-needles');
  private needleEls: { box: HTMLDivElement; ic: HTMLSpanElement; st: HTMLSpanElement }[] = [];
  private links = el('div', 'hud-links');
  private linkEls: { box: HTMLDivElement; ic: HTMLSpanElement; txt: HTMLSpanElement }[] = [];
  private pulse = el('div', 'hud-pulse');
  private time = el('div', 'hud-time');
  private area = el('div', 'hud-area');
  private last = '';

  constructor() {
    for (let i = 0; i < 3; i++) {
      const s = icon(i < 2 ? 'shield' : 'core');
      this.shieldIcons.push(s);
      this.shield.appendChild(s);
    }
    this.shield.appendChild(this.shieldLabel);
    this.boss.append(this.bossName, this.seals);
    for (const id of ['A', 'B', 'C']) {
      const box = el('div', 'hud-needle');
      const ic = icon('needle');
      const nid = el('span', 'nid', id);
      const st = el('span', 'nst');
      box.append(ic, nid, st);
      box.dataset.needle = id;
      this.needles.appendChild(box);
      this.needleEls.push({ box, ic, st });
    }
    for (const id of ['AB', 'BC', 'CA']) {
      const box = el('div', 'hud-link');
      const ic = icon('link');
      const txt = el('span', '', id);
      box.append(ic, txt);
      box.dataset.link = id;
      this.links.appendChild(box);
      this.linkEls.push({ box, ic, txt });
    }
    this.pulse.append(icon('pulse'), el('span', 'key', 'E'), el('span', 'lbl', t('combat.pulse')));
    this.root.append(this.shield, this.boss, this.needles, this.links, this.pulse, this.time, this.area);
  }

  setArea(name: string): void {
    this.area.textContent = name;
  }

  update(sim: Sim): void {
    const p = sim.player;
    const f = sim.fight;
    const plan = planPulse(sim);
    const key = [
      p.shield, p.dead, p.selected, sim.needles.map((n) => n.state).join(), sim.links.map((l) => `${l.valid}${l.state}${l.sig}${l.tone}`).join(),
      f ? f.result : '', sim.boss ? sim.boss.seals.map((s) => s.broken).join() + sim.boss.coreExposed : '', !!plan, p.pulseCd > 0, sim.pendingPulse,
      f ? Math.floor(f.elapsed * 10) : 0,
    ].join('|');
    if (key === this.last) return;
    this.last = key;
    // shield / core
    const inFight = !!f;
    this.shield.classList.toggle('hidden', !inFight);
    setIcon(this.shieldIcons[0]!, p.shield >= 1 && !p.dead ? 'shield' : 'shieldBroken');
    setIcon(this.shieldIcons[1]!, p.shield >= 2 && !p.dead ? 'shield' : 'shieldBroken');
    setIcon(this.shieldIcons[2]!, p.dead ? 'coreBroken' : 'core');
    this.shieldLabel.textContent = p.dead ? '' : p.shield > 0 ? `${t('combat.shield')} ${p.shield}` : t('combat.core');
    this.shield.dataset.shield = String(p.dead ? -1 : p.shield);
    // boss
    this.boss.classList.toggle('hidden', !sim.boss);
    if (sim.boss) {
      this.bossName.textContent = t(`boss.${sim.boss.id}`);
      while (this.seals.children.length < sim.boss.seals.length + 1) this.seals.appendChild(icon('seal'));
      sim.boss.seals.forEach((s, i) => setIcon(this.seals.children[i] as HTMLElement, s.broken ? 'sealBroken' : 'seal'));
      const core = this.seals.children[sim.boss.seals.length] as HTMLElement;
      setIcon(core, 'sealCore');
      core.classList.toggle('hidden', !sim.boss.coreExposed);
      this.seals.dataset.broken = String(sim.boss.seals.filter((s) => s.broken).length);
    }
    // needles
    sim.needles.forEach((n, i) => {
      const e = this.needleEls[i]!;
      e.box.classList.toggle('sel', i === p.selected);
      setIcon(e.ic, n.state === 'Held' ? 'needle' : n.state === 'Disabled' ? 'needleDisabled' : 'needleOut');
      e.st.textContent = STATE_KEY[n.state] ?? n.state;
      e.box.dataset.state = n.state;
    });
    // links
    sim.links.forEach((l, i) => {
      const e = this.linkEls[i]!;
      const charged = l.state === 'Charged' || l.state === 'Overloaded';
      e.box.classList.toggle('on', l.valid);
      e.box.classList.toggle('charged', l.valid && l.state === 'Charged');
      e.box.classList.toggle('over', l.valid && l.state === 'Overloaded');
      setIcon(e.ic, charged && l.sig ? SIG_ICON[l.sig]! : 'link');
      const tone = l.sig === 'Wave' && l.tone >= 0 ? ['·저', '·중', '·고'][l.tone] ?? '' : '';
      e.txt.textContent = `${l.id} ${l.valid ? t(LINK_KEY[l.state]!) + (charged && l.sig ? ` ${t(`sig.${l.sig}`)}${tone}` : '') : l.state === 'Broken' ? t('combat.broken') : ''}`;
      e.box.dataset.state = l.valid ? l.state : 'off';
    });
    // pulse
    const ready = !!plan && p.pulseCd <= 0 && !p.dead;
    this.pulse.classList.toggle('ready', ready);
    this.pulse.dataset.ready = String(ready);
    // time (fights only)
    this.time.classList.toggle('hidden', !f);
    if (f) this.time.textContent = fmtTime(f.elapsed);
  }
}
