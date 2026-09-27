import { Sim } from '../src/core/sim/sim.ts';
import { areaById } from '../src/world/areas/index.ts';
import { bossEntry } from '../src/bosses/registry.ts';
import { BOTS } from '../src/debug/bots/index.ts';

const id = process.argv[2] ?? 'B03';
const every = Number(process.argv[3] ?? 60);
const max = Number(process.argv[4] ?? 3000);
const e = bossEntry(id)!;
const sim = new Sim({ area: areaById(e.areaId)!, seed: 0x5eed + id.charCodeAt(1), boss: e.create(), invulnerable: true });
const bot = BOTS[id]!();
for (let i = 0; i < max; i++) {
  const f = bot.next(sim);
  sim.step(f);
  if (sim.boss!.coreExposed && sim.tick % every === 0) {
    const n = sim.needles.map((x) => `${x.id}:${x.state}@${x.host?.shapeId ?? '-'}`).join(' ');
    const l = sim.links.map((x) => `${x.id}:${x.valid ? 'V' : x.blocked}/${x.state}/${x.sig ?? ''}`).join(' ');
    console.log(`${sim.tick} p=(${sim.player.pos.x.toFixed(0)},${sim.player.pos.y.toFixed(0)}) lat=${sim.lattice.formed} ${n} | ${l} | ${JSON.stringify(sim.boss!.debugInfo())}`);
  }
  if (sim.fight?.result === 'victory') break;
}
console.log(sim.fight?.result);
