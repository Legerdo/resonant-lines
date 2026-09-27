# 공명선: 봉인된 심장 — progress

현재 Stage/Gate: Stage 4 (Full boss set) 진행 중 — B01~B06 구현(시뮬+아트+뷰+봇). 다음: B07, B08, FINAL, 엔딩, E2E, RC 검증.

## 핵심 설계 결정 (compaction 후 참고)
- Stack: TypeScript 7.0.2 strict (erasableSyntaxOnly → parameter property/enum 금지, .ts import 확장자), Phaser 4.2.1 (렌더/씬/텍스처/카메라), Vite 8, Vitest 5, Playwright 1.63.
- Sim: `src/core/sim/sim.ts` 1 Sim = 1 area/arena 시도. 재도전 = 새 Sim. 60Hz fixed step.
- Pulse(E): 커서에 가장 가까운 (충전 선이 있는) embedded 침 = 목표, 연결된 충전 선 전부가 목표로 흐름. `sim.flowInverted`/`sim.invertedLinks` 로 역류 방향 반전(B05 썰물, FINAL Phase B).
- Boss 인터페이스 `src/bosses/framework/boss.ts`: setup/update/onPulseDelivered/onAttackLink/onNeedleHit/canRecall/updateDefeated/view.
- 등록 위치: `src/bosses/registry.ts` (factories), `src/world/areas/arenas.ts` (ARENA_Bxx 자동 등록), `src/presentation/bosses/*View.ts` + `all.ts`, `art/source/boss*.ts` + `art/source/index.ts`, `src/debug/bots/*Bot.ts` + `bots/index.ts`.
- 봇: 입력 프레임만 생성 (A16 fixture). `botKit.ts`: Placer(선택/회수/발사/리드샷), survive(회피), threat().
- 헤드리스 봇 디버그: `node tests/scratch.ts B0x [invuln]`, 이벤트 추적 `node tests/scratch2.ts`.
- Art: `npm run art` → public/assets + manifest. 미리보기 `art/preview/*@4x.png`. `sculpt()` mask 셰이딩 + accents.

## 보스 요약
- B01 그람(quarry): 돌진 Impact 포획 → 봉인석 면 방향 (N남/W동/E북에서 들어와야) → 코어 소켓 + 격자 pin → 코어로 역류.
- B02 허밍(belfry): 음높이 0/1/2 Wave 링 → 같은 음 종에 전달, 틀린 종 = 불협(이중 링) → 추(TemporaryAnchor, 1.8/3s 발광) + 화음(tone3) 전달.
- B03 네라(marsh): 4 분신, 진짜만 굴절/부착. A Heat, B 등 뒤에서(dot(dir,facing)>0.3), C Overloaded Heat → 수영하는 본체를 격자 내부에 가두고 Heat.
- B04 모라(garden): 도관 c0(bridge+slam, a쪽으로) → c3(뿌리끝 MovingAnchor에서) → c1(fork-in 2선 동시) → 심장 ← 전원 도관 a단자 자동충전.
- B05 역조의 눈(marsh): 떠다니는 뗏목, 평면 파면은 선이 평행(24°)일 때만 포획, 8초마다 조류 반전(흐름 반전). 윗눈꺼풀 Wave(뗏목발), 아랫눈꺼풀 Impact 물줄기(뗏목발), 누관 Overloaded Wave, 동공 = 동공+뗏목2 격자 + Wave.
- B06 브락(quarry): 박힌 침을 삼킴(내부 endpoint, 회수 불가). A 지하에서 Impact, B 분사 Heat가 선을 따라(22°), C 지상 노출 중 Impact → 드릴 코어 + 기둥2 격자, 세 선 모두 충전 후 코어로.

## AutoVerified
- tests/resonance.test.ts: A01~A15 framework-level
- tests/bosses.test.ts: A16 (B01~B06 clear with zero tunings, input-only bots), A15 per boss, B01 rules

## 변경한 TUNABLE
- dashIFrames 0.10 → 0.12 (링 대시 통과 여유)

## 재현 명령
- npm run art / npm run typecheck / npm run test / npm run build / npm run test:e2e / npm run verify
