import { Sim } from '../src/core/sim/sim.ts';
import { areaById } from '../src/world/areas/index.ts';
import { bossEntry } from '../src/bosses/registry.ts';
import { BOTS } from '../src/debug/bots/index.ts';

const id = process.argv[2] ?? 'B06';
const max = Number(process.argv[3] ?? 17000);
const e = bossEntry(id)!;
const sim = new Sim({ area: areaById(e.areaId)!, seed: 0x5eed + id.charCodeAt(1), boss: e.create(), invulnerable: true });
const bot = BOTS[id]!();
let shown = 0;
for (let i = 0; i < max; i++) {
  const f = bot.next(sim);
  const ev = sim.step(f);
  for (const x of ev) {
    if ((x.type === 'pulseFired' || x.type === 'pulseDelivered' || x.type === 'capture' || x.type === 'sealRejected') && shown < 30) {
      shown++;
      console.log(sim.tick, x.type, x.sig, x.result ?? '', x.text ?? '', x.link ?? '', JSON.stringify(sim.boss!.debugInfo()));
    }
  }
  if (sim.fight?.result === 'victory') break;
}
console.log(sim.fight?.result);
