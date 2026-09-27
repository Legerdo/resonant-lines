// A19 Korean UI at UI scale 100 / 125 / 150 % on 1280x720, 1920x1080 and 2560x1440 (production bundle).
// Every main screen — title, new-game confirm, settings, records (title + stele with the replay list), tuning altar,
// pause (in a fight), hub HUD (area card, toast, device prompt, tutorial hint), combat HUD, death card, victory card
// and the ending — is audited in the live DOM:
//   outside      a box leaves the game viewport (and is not inside a scrolling panel)
//   text         a text run extends past its own box (clipped by overflow, or spilling over its frame)
//   clipped      an overflow-hidden box is narrower than its content
//   contain      an in-flow element pokes out of its parent box (e.g. a label wider than its button)
//   overlap      two pieces of content (text / icon / control) intersect
//   block        two HUD / overlay plates intersect
//   hclip        content of a scrolling panel is cut horizontally;  hscroll: a panel needs sideways scrolling
//   unreachable  an element in a scrolling panel lies outside the scroll range or is taller than the panel
//   probe        scrolling the panel to a control does not bring it fully into the panel and the viewport
//   nav          ArrowDown through every button lands on a focused button that is not fully visible
//   layer        the UI layer / page got scrolled (focus scrollIntoView leaking past the panel)
// Content inside a scrolling panel is NOT reported as "outside" just because it is scrolled out of view — it is
// checked for reachability instead. The self-test injects one known defect of each kind (plus reachable scrolled
// content) to prove the auditor reports real problems and does not report scrollable content.
import { test, expect, type Page } from '@playwright/test';
import { boot, state, waitArea, waitFor, turbo, runBot, go, trackErrors, writeEvidence, EVIDENCE } from './helpers.ts';
import { newSave, SAVE_KEY } from '../src/save/save.ts';
import { completeBoss, setFlag } from '../src/progression/progress.ts';

// a long run with ~135 screenshots produces a trace too large to finalize; the audit JSON + screenshots are the evidence
test.use({ trace: 'off' });

interface Audit {
  checked: number;
  atoms: number;
  blocks: number;
  scrollers: number;
  probes: number;
  nav: number;
  issues: string[];
}

/** DOM layout audit of #ui (see header). Runs entirely in the page. */
async function audit(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const T = 1; // px tolerance for sub-pixel layout rounding
    const ui = document.getElementById('ui')!;
    const vp = document.getElementById('viewport')!.getBoundingClientRect();
    const issues: string[] = [];
    type Box = { left: number; top: number; right: number; bottom: number };
    const within = (r: Box, c: Box) => r.left >= c.left - T && r.top >= c.top - T && r.right <= c.right + T && r.bottom <= c.bottom + T;
    const hit = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > T && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > T;
    const label = (e: Element): string => {
      const h = e as HTMLElement;
      const cls = typeof h.className === 'string' && h.className.trim() ? `.${h.className.trim().split(/\s+/).join('.')}` : '';
      const id = h.dataset?.id ? `[${h.dataset.id}]` : '';
      return `${e.tagName.toLowerCase()}${cls}${id}"${(e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 14)}"`;
    };
    const shown = (e: Element | null): e is HTMLElement => {
      if (!(e instanceof HTMLElement)) return false;
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const scrolls = (p: HTMLElement): boolean => {
      const cs = getComputedStyle(p);
      return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + T;
    };
    const scrollerOf = (e: HTMLElement): HTMLElement | null => {
      for (let p = e.parentElement; p && p !== ui; p = p.parentElement) if (scrolls(p)) return p;
      return null;
    };
    const client = (s: HTMLElement): Box => {
      const r = s.getBoundingClientRect();
      const left = r.left + s.clientLeft;
      const top = r.top + s.clientTop;
      return { left, top, right: left + s.clientWidth, bottom: top + s.clientHeight };
    };
    const layerOf = (e: Element): Element => {
      let x = e;
      while (x.parentElement && x.parentElement !== ui) x = x.parentElement;
      return x;
    };
    /** the part of `r` actually painted: clipped by every overflow-clipping ancestor up to and including #ui */
    const painted = (e: HTMLElement, r: Box): Box | null => {
      // explicit copy: DOMRect edges are prototype getters, so `{ ...rect }` would be an empty object
      const v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (let p = e.parentElement; p && p !== ui.parentElement; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const c = client(p);
        v.left = Math.max(v.left, c.left);
        v.top = Math.max(v.top, c.top);
        v.right = Math.min(v.right, c.right);
        v.bottom = Math.min(v.bottom, c.bottom);
      }
      return v.right - v.left > T && v.bottom - v.top > T ? v : null;
    };
    const screen = document.querySelector('#ui > .screen');
    const modal = shown(screen) && (screen.classList.contains('dim') || screen.classList.contains('solid'));

    const els = Array.from(ui.querySelectorAll('*')).filter(shown);
    const atoms: { e: HTMLElement; r: Box; layer: Element }[] = [];
    const scrollers = new Set<HTMLElement>();
    for (const e of els) {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const s = scrollerOf(e);
      if (s) {
        scrollers.add(s);
        const c = client(s);
        if (r.left < c.left - T || r.right > c.right + T) issues.push(`hclip ${label(e)}`);
        const top = r.top - c.top + s.scrollTop;
        if (top < -T || top + r.height > s.scrollHeight + T) issues.push(`unreachable ${label(e)}`);
        if (r.height > s.clientHeight + T) issues.push(`unreachable(taller than panel) ${label(e)}`);
      } else if (!within(r, vp)) issues.push(`outside ${label(e)}`);
      // in-flow children stay inside their parent's box (a scroller's own children are covered above)
      const par = e.parentElement;
      const positioned = cs.position === 'absolute' || cs.position === 'fixed';
      if (par && par !== ui && !positioned && !(s && par === s) && shown(par) && !within(r, par.getBoundingClientRect())) {
        issues.push(`contain ${label(e)} in ${label(par)}`);
      }
      // every text run stays inside its own box
      const t: Box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      for (const n of Array.from(e.childNodes)) {
        if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? '').trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const q of Array.from(rg.getClientRects())) {
          if (q.width === 0 || q.height === 0) continue;
          t.left = Math.min(t.left, q.left);
          t.top = Math.min(t.top, q.top);
          t.right = Math.max(t.right, q.right);
          t.bottom = Math.max(t.bottom, q.bottom);
        }
      }
      const hasText = t.right > t.left;
      if (hasText && !within(t, r)) issues.push(`text ${label(e)}`);
      if (scrolls(e) && e.scrollWidth > e.clientWidth + T) issues.push(`hscroll ${label(e)}`);
      else if (cs.overflowX !== 'visible' && e.tagName !== 'INPUT' && e.scrollWidth > e.clientWidth + T) issues.push(`clipped ${label(e)}`);
      // content atoms: text runs, icons and controls (a control's whole frame counts: two buttons must never overlap)
      const control = e.tagName === 'BUTTON' || e.tagName === 'INPUT' || e.tagName === 'SELECT';
      if (hasText || control || e.classList.contains('icon')) {
        // content scrolled out of its panel is not painted, so it cannot visually overlap anything right now
        const vis = painted(e, control || !hasText ? r : t);
        if (vis) atoms.push({ e, r: vis, layer: layerOf(e) });
      }
    }
    // content overlap: within the open menu only when it is modal (the dimmed HUD below is covered by design)
    const pool = modal ? atoms.filter((a) => a.layer === screen) : atoms;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i]!;
        const b = pool[j]!;
        if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
        if (hit(a.r, b.r)) issues.push(`overlap ${label(a.e)} x ${label(b.e)}`);
      }
    }
    // HUD / overlay plates must not collide with each other (or with a non-modal card such as the victory card)
    const blocks = modal ? [] : Array.from(ui.querySelectorAll(':scope > .hud > *, :scope > .hint-bar, :scope > .prompt, :scope > .toast, :scope > .boss-card')).filter(shown);
    if (!modal && shown(screen)) blocks.push(...Array.from(screen.children).filter(shown));
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (hit(blocks[i]!.getBoundingClientRect(), blocks[j]!.getBoundingClientRect())) issues.push(`block ${label(blocks[i]!)} x ${label(blocks[j]!)}`);
      }
    }
    // scroll every control of every scrolling panel into the panel window: it must then be fully visible
    let probes = 0;
    for (const s of scrollers) {
      const saved = s.scrollTop;
      for (const b of Array.from(s.querySelectorAll('button, input, select')).filter(shown)) {
        const r0 = b.getBoundingClientRect();
        s.scrollTop = Math.max(0, r0.top - client(s).top + s.scrollTop - (s.clientHeight - r0.height) / 2);
        const r = b.getBoundingClientRect();
        if (!within(r, client(s)) || !within(r, vp)) issues.push(`probe ${label(b)}`);
        probes++;
      }
      s.scrollTop = saved;
    }
    for (const x of [ui, document.getElementById('viewport'), document.getElementById('app'), document.scrollingElement]) {
      if (x && (x.scrollTop !== 0 || x.scrollLeft !== 0)) issues.push(`layer ${x.id || x.tagName} scrolled ${x.scrollLeft},${x.scrollTop}`);
    }
    return { checked: els.length, atoms: atoms.length, blocks: blocks.length, scrollers: scrollers.size, probes, nav: 0, issues };
  });
}

/** keyboard/gamepad reachability: ArrowDown through every button, the focused one must be fully visible each time */
async function navProbe(page: Page): Promise<{ steps: number; issues: string[] }> {
  const n = await page.locator('#ui > .screen button.btn:not([disabled])').count();
  const issues: string[] = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('ArrowDown');
    const bad = await page.evaluate(() => {
      const f = document.querySelector<HTMLElement>('#ui > .screen button.btn.focus');
      if (!f) return 'no focused button';
      const ui = document.getElementById('ui')!;
      if (ui.scrollTop !== 0 || ui.scrollLeft !== 0) return `ui layer scrolled to ${ui.scrollLeft},${ui.scrollTop}`;
      const r = f.getBoundingClientRect();
      const vp = document.getElementById('viewport')!.getBoundingClientRect();
      let ok = r.top >= vp.top - 1 && r.bottom <= vp.bottom + 1 && r.left >= vp.left - 1 && r.right <= vp.right + 1;
      for (let p = f.parentElement; p && p !== ui; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const pr = p.getBoundingClientRect();
        const top = pr.top + p.clientTop;
        const left = pr.left + p.clientLeft;
        if (r.top < top - 1 || r.bottom > top + p.clientHeight + 1 || r.left < left - 1 || r.right > left + p.clientWidth + 1) ok = false;
      }
      return ok ? '' : `focused ${f.dataset.id ?? ''} "${(f.textContent ?? '').trim().slice(0, 14)}" not fully visible`;
    });
    if (bad) issues.push(`nav ${bad}`);
  }
  return { steps: n, issues };
}

const STORY = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08'];

/** a real SaveData produced by the game's own progression rules (fixture content only, no gameplay shortcuts) */
function fixture(done: readonly string[], uiScale: number, endingSeen = false): string {
  const s = newSave();
  s.settings.uiScale = uiScale;
  for (const f of ['tutorialDone', 'puzzle:quarry', 'puzzle:garden', 'puzzle:belfry', 'puzzle:marsh']) setFlag(s, f);
  s.unlockedRegions = ['garden', 'belfry', 'quarry', 'marsh'];
  // widest records: 59:59.xx best times and two-digit death counts (a replay then also shows '신기록')
  done.forEach((id, i) => {
    completeBoss(s, id, 3599.99 - i);
    s.bossDeathCounts[id] = 99;
  });
  if (endingSeen) {
    s.endingSeen = true;
    s.fullClearBestTime = 5999.99;
    setFlag(s, 'heartRestarted');
  }
  s.lastArea = 'hub';
  s.lastSpawn = 'center';
  return JSON.stringify(s);
}

async function seed(page: Page, json: string): Promise<void> {
  await boot(page);
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, json] as const);
  await boot(page);
  await waitFor(page, `window.__RESONANT__.state().screen === 'title'`, 10_000);
}

async function setScale(page: Page, pct: number): Promise<void> {
  const val = page.locator('button[data-id="uiScale"] .val');
  for (let i = 0; i < 3 && (await val.innerText()) !== `${pct}%`; i++) await page.locator('button[data-id="uiScale"]').click();
  await expect(val).toHaveText(`${pct}%`);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui').trim())).toBe(String(pct / 100));
}

const screenIs = (name: string) => `window.__RESONANT__.state().screen === '${name}'`;
const shownSel = (sel: string) => `(() => { const e = document.querySelector('${sel}'); return !!e && e.checkVisibility(); })()`;

async function oneSize(page: Page, w: number, h: number, report: Record<string, Audit>): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  for (const pct of [100, 125, 150]) {
    const tag = `${w}x${h}-${pct}`;
    const snap = async (name: string, nav = false): Promise<void> => {
      await page.waitForTimeout(120); // let the last DOM change lay out
      const a = await audit(page);
      if (nav) {
        const np = await navProbe(page);
        a.nav = np.steps;
        a.issues.push(...np.issues);
      }
      report[`${tag}-${name}`] = a;
      expect.soft(a.checked, `${tag}-${name}: audited elements`).toBeGreaterThan(3);
      expect.soft(a.issues, `${tag}-${name}`).toEqual([]);
      await page.screenshot({ path: `${EVIDENCE}/ui-${tag}-${name}.png` });
    };

    // ---- save A: four story bosses done, heart gate still shut; the UI scale is set through the settings menu
    await seed(page, fixture(['B01', 'B06', 'B07', 'B08'], 1));
    await page.locator('button[data-id="settings"]').click();
    await waitFor(page, screenIs('settings'), 5_000);
    await setScale(page, pct);
    await snap('settings', true);
    await page.locator('button[data-id="back"]').click();
    await waitFor(page, screenIs('title'), 5_000);
    await snap('title', true);
    await page.locator('button[data-id="new"]').click();
    await waitFor(page, screenIs('confirm'), 5_000);
    await snap('confirm', true);
    await page.locator('button[data-id="no"]').click();
    await page.locator('button[data-id="records"]').click();
    await waitFor(page, screenIs('records'), 5_000);
    await snap('records-title', true);
    await page.locator('button[data-id="back"]').click();
    await page.locator('button[data-id="continue"]').click();
    await waitArea(page, 'hub');
    await snap('hub-arrival'); // area title card + needle / link / pulse HUD
    await turbo(page, 3);
    await runBot(page, 'walk:hub>heart'); // sealed heart door: toast with the 4/5 count
    await turbo(page, 1);
    await waitFor(page, shownSel('#ui > .toast'), 5_000);
    await snap('hub-toast');
    await turbo(page, 3);
    await go(page, 'records');
    await turbo(page, 1);
    await waitFor(page, shownSel('#ui > .prompt'), 5_000);
    await snap('hub-prompt');
    // the 5th distinct boss: the widest victory card (time + new best + tuning unlocked + heart opened)
    await page.evaluate(() => {
      const api = window.__RESONANT__!;
      api.invulnerable(true);
      api.armBot('arena_B02', 'B02');
      api.enter('arena_B02', 'default');
    });
    await waitArea(page, 'arena_B02');
    await turbo(page, 6);
    await page.waitForFunction(() => {
      const api = window.__RESONANT__!;
      const r = api.state().sim?.fight?.result;
      if (r === 'victory') api.turbo(1); // the card is timed in (turbo-scaled) sim time
      return r === 'victory' || r === 'defeat';
    }, undefined, { polling: 'raf', timeout: 90_000 });
    expect((await state(page)).sim?.fight?.result).toBe('victory');
    await waitFor(page, screenIs('victory'), 10_000);
    const card = await page.locator('#ui > .screen').innerText();
    await snap('victory');
    expect.soft(card, `${tag} victory card`).toContain('심장문이 열렸다');
    expect.soft(card, `${tag} victory card`).toContain('새 공명 조율');
    expect.soft(card, `${tag} victory card`).toContain('최고 기록');
    await page.evaluate(() => {
      window.__RESONANT__!.stopBot();
      window.__RESONANT__!.invulnerable(false);
    });

    // ---- save B: every boss done and the ending seen: the longest replay list and all eight tunings
    await seed(page, fixture([...STORY, 'FINAL'], pct / 100, true));
    await page.locator('button[data-id="continue"]').click();
    await waitArea(page, 'hub');
    await turbo(page, 3);
    await go(page, 'records');
    await runBot(page, 'press');
    await turbo(page, 1);
    await waitFor(page, screenIs('records'), 10_000);
    expect(await page.locator('button[data-id^="replay-"]').count()).toBe(9);
    await snap('records-stele', true);
    await page.locator('button[data-id="back"]').click();
    await turbo(page, 3);
    await go(page, 'altar');
    await runBot(page, 'press');
    await turbo(page, 1);
    await waitFor(page, screenIs('tuning'), 10_000);
    // equip two at the altar; a third is refused (max 2); the panel shows both as equipped
    for (const id of ['longLine', 'echo', 'swiftNeedle']) await page.locator(`button[data-id="tuning-${id}"]`).click();
    expect((await state(page)).save.equipped).toEqual(['longLine', 'echo']);
    await snap('tuning', true);
    for (const id of ['longLine', 'echo']) await page.locator(`button[data-id="tuning-${id}"]`).click();
    expect((await state(page)).save.equipped).toEqual([]);
    await page.locator('button[data-id="back"]').click();
    // combat HUD (boss name, seals, shields, needles, links, pulse, timer), then the in-fight pause menu (+ retry)
    await page.evaluate(() => {
      const api = window.__RESONANT__!;
      api.invulnerable(true);
      api.armBot('arena_B08', 'B08');
      api.enter('arena_B08', 'default');
    });
    await waitArea(page, 'arena_B08');
    await page.waitForTimeout(2600); // boss title card gone, fight running
    await snap('hud-boss');
    await page.evaluate(() => window.__RESONANT__!.stopBot());
    await page.keyboard.press('Escape');
    await waitFor(page, screenIs('pause'), 5_000);
    await expect(page.locator('button[data-id="retry"]')).toBeVisible();
    await snap('pause', true);
    await page.locator('button[data-id="resume"]').click();
    // death card
    await page.evaluate(() => {
      const api = window.__RESONANT__!;
      api.invulnerable(false);
      api.armBot('arena_B01', 'idle');
      api.enter('arena_B01', 'default');
    });
    await waitArea(page, 'arena_B01');
    await turbo(page, 6);
    await waitFor(page, `window.__RESONANT__.state().sim?.fight?.result === 'defeat'`, 90_000);
    await turbo(page, 1);
    await waitFor(page, screenIs('death'), 10_000);
    await snap('death');
    await page.evaluate(() => window.__RESONANT__!.stopBot());
    await page.keyboard.press('Escape');
    await waitArea(page, 'hub');
    // ending (story FINAL victory → heart restarts → ending card sequence)
    await page.evaluate(() => {
      const api = window.__RESONANT__!;
      api.invulnerable(true);
      api.armBot('arena_FINAL', 'FINAL');
      api.enter('arena_FINAL', 'default');
    });
    await waitArea(page, 'arena_FINAL');
    await turbo(page, 8);
    await waitFor(page, `window.__RESONANT__.state().mode === 'ending'`, 120_000);
    await turbo(page, 1);
    await page.evaluate(() => window.__RESONANT__!.invulnerable(false));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('button[data-id="toTitle"]')!.parentElement!).opacity === '1', undefined, { timeout: 20_000 });
    await snap('ending', true);
    await page.locator('button[data-id="toTitle"]').click();
    await waitFor(page, `window.__RESONANT__.state().mode === 'title'`, 10_000);
    // new game keeps the UI scale: first-play tutorial hint bar in the antechamber
    await page.locator('button[data-id="new"]').click();
    await waitFor(page, screenIs('confirm'), 5_000);
    await page.locator('button[data-id="yes"]').click();
    await waitArea(page, 'hub');
    await waitFor(page, shownSel('#ui > .hint-bar'), 5_000);
    await snap('hub-tutorial');
  }
}

test('auditor self-test: reports injected defects, ignores reachable scrolled content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seed(page, fixture([], 1));
  const clean = await audit(page);
  expect(clean.issues).toEqual([]);
  await page.evaluate(() => {
    const ui = document.getElementById('ui')!;
    // isolate the probe from the title menu underneath
    (document.querySelector('#ui > .screen') as HTMLElement).style.visibility = 'hidden';
    const probe = document.createElement('div');
    probe.id = 'audit-probe';
    probe.innerHTML = `
      <div data-id="p-outside" style="position:absolute;left:-60px;top:8px;width:40px">밖으로</div>
      <div style="position:absolute;left:20px;top:40px;width:300px;background:#000">
        <div data-id="p-spill" style="width:30px;white-space:nowrap">넘치는 한국어 문장이 길다</div>
        <div data-id="p-clip" style="width:30px;white-space:nowrap;overflow:hidden">잘리는 한국어 문장이 길다</div>
        <div style="display:flex;width:60px"><span data-id="p-wide" style="flex:none;width:120px">넓은</span></div>
        <span data-id="p-a">겹침가</span><span data-id="p-b" style="position:relative;left:-24px">겹침나</span>
      </div>
      <div data-id="p-scroller" style="position:absolute;left:400px;top:40px;width:200px;height:60px;overflow:auto">
        <button data-id="p-b1" style="display:block;height:40px">항목1</button>
        <button data-id="p-b2" style="display:block;height:40px">항목2</button>
        <button data-id="p-b3" style="display:block;height:40px">항목3 (스크롤로 도달)</button>
      </div>
      <div data-id="p-hscroll" style="position:absolute;left:400px;top:140px;width:100px;height:40px;overflow:auto">
        <div style="width:300px;height:80px">가로로 넘치는 패널</div>
      </div>
      <div data-id="p-tall" style="position:absolute;left:400px;top:220px;width:200px;height:40px;overflow:auto">
        <div style="height:120px">패널보다 큰 항목</div>
      </div>
      <div style="position:absolute;left:20px;top:300px;width:300px;height:60px">
        <button data-id="p-btn1" style="display:block;width:200px;height:24px;text-align:left">왼쪽</button>
        <button data-id="p-btn2" style="display:block;position:relative;left:150px;top:-12px;width:100px;height:24px">오른쪽</button>
      </div>
      <span class="icon" data-id="p-i1" style="position:absolute;left:340px;top:300px;width:24px;height:24px;background:#fff"></span>
      <span class="icon" data-id="p-i2" style="position:absolute;left:352px;top:310px;width:24px;height:24px;background:#fff"></span>`;
    ui.appendChild(probe);
  });
  const r = await audit(page);
  await page.evaluate(() => {
    document.getElementById('audit-probe')?.remove();
    (document.querySelector('#ui > .screen') as HTMLElement).style.visibility = '';
  });
  console.log(`[auditor self-test] ${r.issues.length} issues:\n  ${r.issues.join('\n  ')}`);
  writeEvidence('ui-audit-selftest', { issues: r.issues, probes: r.probes, scrollers: r.scrollers });
  expect((await audit(page)).issues).toEqual([]);
  const has = (kind: string, id: string) => r.issues.some((i) => i.startsWith(kind) && i.includes(`[${id}]`));
  expect(has('outside', 'p-outside'), r.issues.join('\n')).toBe(true);
  expect(has('text', 'p-spill'), r.issues.join('\n')).toBe(true);
  expect(has('clipped', 'p-clip'), r.issues.join('\n')).toBe(true);
  expect(has('contain', 'p-wide'), r.issues.join('\n')).toBe(true);
  expect(r.issues.some((i) => i.startsWith('overlap') && i.includes('[p-a]') && i.includes('[p-b]')), r.issues.join('\n')).toBe(true);
  // two button frames overlapping while their labels do not (the 150% settings defect this auditor found)
  expect(r.issues.some((i) => i.startsWith('overlap') && i.includes('[p-btn1]') && i.includes('[p-btn2]')), r.issues.join('\n')).toBe(true);
  expect(r.issues.some((i) => i.startsWith('overlap') && i.includes('[p-i1]') && i.includes('[p-i2]')), r.issues.join('\n')).toBe(true);
  expect(has('hscroll', 'p-hscroll'), r.issues.join('\n')).toBe(true);
  expect(r.issues.some((i) => i.startsWith('unreachable(taller than panel)') && i.includes('패널보다')), r.issues.join('\n')).toBe(true);
  // scrolled-out but reachable controls are probed, never reported
  expect(r.issues.filter((i) => /p-b[123]/.test(i)), r.issues.join('\n')).toEqual([]);
  expect(r.probes).toBeGreaterThanOrEqual(3);
  expect(r.scrollers).toBeGreaterThanOrEqual(3);
});

test('A19 UI scale 100/125/150% keeps every Korean screen readable at 1280x720, 1920x1080, 2560x1440', async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors = trackErrors(page);
  const report: Record<string, Audit> = {};
  try {
    for (const [w, h] of [[1280, 720], [1920, 1080], [2560, 1440]] as const) await oneSize(page, w, h, report);
  } finally {
    writeEvidence('ui-scale', report);
  }
  expect(Object.keys(report).length).toBe(3 * 3 * 15);
  expect(errors).toEqual([]);
});
