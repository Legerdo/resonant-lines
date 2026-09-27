// Headless boss runner for bot development: node tests/scratch.ts B01 [invuln]
import { Sim } from '../src/core/sim/sim.ts';
import { areaById } from '../src/world/areas/index.ts';
import { bossEntry } from '../src/bosses/registry.ts';
import { BOTS } from '../src/debug/bots/index.ts';

const id = process.argv[2] ?? 'B01';
const invuln = process.argv.includes('invuln');
const e = bossEntry(id)!;
const sim = new Sim({ area: areaById(e.areaId)!, seed: 0x5eed + id.charCodeAt(1), boss: e.create(), invulnerable: invuln });
const bot = BOTS[id]!();
let i = 0;
for (; i < 60 * 300; i++) {
  const f = bot.next(sim);
  const ev = sim.step(f);
  for (const e of ev) {
    if (e.type === 'playerHit') {
      const p = sim.player;
      const at = sim.attacks.filter((a) => a.hitPlayer).map((a) => `${a.kind}/${a.owner} ph=${a.phase} t=${a.t.toFixed(2)} ${JSON.stringify(a.shape)}`);
      console.log(`HIT @${sim.tick} p=(${p.pos.x.toFixed(0)},${p.pos.y.toFixed(0)}) dash=${p.dash.active} move=(${f.move.x.toFixed(2)},${f.move.y.toFixed(2)}) ${at.join(' ; ')}`);
    }
  }
  const r = sim.fight?.result;
  if (r === 'victory' || r === 'defeat') break;
}
console.log(`result=${sim.fight?.result} ticks=${i} time=${sim.fight?.elapsed.toFixed(1)}s shield=${sim.player.shield} cause=${sim.fight?.deathCause}`);
console.log('seals', sim.boss!.seals.map((s) => `${s.id}:${s.broken}`).join(' '), 'phase', sim.boss!.phase, JSON.stringify(sim.boss!.debugInfo()));
console.log(bot.log.join('\n'));
const tail = sim.log.slice(-40);
console.log(tail.join('\n'));
