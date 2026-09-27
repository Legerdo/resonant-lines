# 공명선: 봉인된 심장 — progress

현재 Stage/Gate: Stage 1 (Resonance core) — core sim + 20 unit tests PASS. Next: Stage 0 browser boot + presentation.

## 핵심 설계 결정 (compaction 후 참고)
- Stack: TypeScript 7.0.2 strict (erasableSyntaxOnly, .ts import 확장자), Phaser 4.2.1 (렌더링/씬/텍스처/카메라만), Vite 8, Vitest 5, Playwright 1.63 (chromium).
- Sim: `src/core/sim/sim.ts` 1 Sim = 1 area/arena 시도. 재도전 = 새 Sim (잔존 상태 0). 60Hz fixed step (`FixedStepClock`).
- 입력: `InputFrame` (move, aim(world), fire, recall, recallAll, selNext/Prev, selIndex, pulse, dash). Esc/pause 는 앱 계층.
- Needle: 항상 A/B/C 3객체. 상태 Held/Flying/EmbeddedWorld/EmbeddedBoss/Disabled/Returning. swept raycast (이동 body는 prev→cur 상대운동).
  - LMB: 선택 침이 Held면 발사, 아니면 다음 Held. 발사 후 선택은 다음 Held로 이동. RMB: 선택 침(밖)이면 회수, 선택이 Held면 커서에 가장 가까운 밖의 침 회수. R: 전체 회수.
  - NonAnchorable 충돌 → Disabled(0.8s) → Returning. 최대 비행 300px → Returning.
- Link: 두 침 embedded + 거리 10..180 + LOS(blocksLink) + Broken 아님. 무효화 시 charge 소실.
  - capture: 공격 shape(circle/ring(arc)/capsule) vs link 세그먼트 4-substep. 공격 id별 1회(provenance). continuous(Heat)는 progress 0.35s.
  - Charged 동일 sig+tone 재포획 → Overloaded(3s 후 Broken), 다른 sig → 교체. Overloaded에 추가 포획 → Broken.
- Pulse(E): **커서에 가장 가까운 (충전된 선을 가진) embedded 침 = 목표**. 그 침에 닿은 충전 선 전부가 목표 쪽으로 흐름(A→B 는 B의 host에 전달). 속도 720px/s, startup 0.1s, cd 0.45s. 전달 = `boss.onPulseDelivered` → `logic.onPulseDelivered`. 경로 hit = `onPulsePath`.
- Lattice: 3선 valid + 면적 ≥ 300.
- Shield: 2→1→0(Core)→Dead. lethal 공격 즉사. 피격 후 0.65s 무적, dash 첫 0.1s 무적. 성공 Pulse 2회(피해 상태에서) → Shield +1, 전투당 1회.
- Tie: `resolveDecisive` — victory t < lethal t - eps → 승리, 아니면 사망.
- Seal: `sim.breakSeal(id, eventKey)` idempotent. 필수 seal 전부 → coreExposed. `sim.requestVictory(t,pos)`.
- Art: palette-indexed sources `art/source/*.ts` → `npm run art` → `public/assets/**.png` + manifest.json. 미리보기 `art/preview/*@4x.png`.
  - `sculpt()` = 손으로 그린 region mask + 방향광 ramp 양자화 + orphan 정리. `outline()` = sel-out 1px.
- Tunings (보스별 1개 해금, 최대 2개 장착): longLine, swiftNeedle, elasticNeedle, stableNet, echo, rapidTune, wideCapture, threadWeaver.

## 완료 기능
- core math/geometry/rng/clock, Sim tick, player move/dash/guard, needle, link/lattice/thread step, capture, pulse, attacks(ring/zone/projectile/beam/custom)

## AutoVerified
- tests/resonance.test.ts: A01~A15 framework-level (20 tests)

## RuntimeVerified / VisualVerified
- (none yet)

## 변경한 TUNABLE
- (기본값 그대로)

## 재현 명령
- npm run art / npm run typecheck / npm run test / npm run build / npm run test:e2e / npm run verify
