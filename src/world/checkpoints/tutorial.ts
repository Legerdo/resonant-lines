// First-play learning: the hint shows only the next verb, never the solution position.
import { t } from '../../localization/ko.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { isEmbedded } from '../../resonance/needle.ts';

export function tutorialHint(sim: Sim): string | null {
  const embedded = sim.needles.filter(isEmbedded).length;
  const anyLink = sim.links.some((l) => l.valid);
  const charged = sim.links.some((l) => l.valid && (l.state === 'Charged' || l.state === 'Overloaded'));
  if (charged) return t('hint.pulseKey');
  if (anyLink) return t('hint.captureKey');
  if (embedded >= 1) return t('hint.linkKey');
  return t('hint.fireKey');
}
