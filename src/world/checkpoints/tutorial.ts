// First-play learning: the hint shows only the next verb, never the solution position.
import { t } from '../../localization/ko.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { isEmbedded } from '../../resonance/needle.ts';

export function tutorialHint(sim: Sim): string | null {
  if (sim.flags.has('tutorialDone')) return null;
  const embedded = sim.needles.filter(isEmbedded).length;
  const linked = sim.links.some((l) => l.valid);
  const charged = sim.links.some((l) => l.valid && (l.state === 'Charged' || l.state === 'Overloaded'));
  if (charged) return t('tutorial.pulse');
  if (linked) return t('tutorial.wait');
  if (embedded >= 2) return t('tutorial.fixLine');
  if (embedded === 1) return t('tutorial.secondNeedle');
  return t('tutorial.firstNeedle');
}
