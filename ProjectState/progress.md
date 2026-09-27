# 공명선: 봉인된 심장 — progress

## 현재 Stage/Gate
Stage 6 (Release Candidate) 검증 단계. Gate 0~5 통과(아래 증거). RC 항목 중 사람이 봐야 하는 아트 품질 검수(A22/A23), 실제 GPU·실물 게임패드·HTTPS 호스팅만 ManualQARequired.

## 완료 기능
- 코어: 60 Hz 고정 스텝 시뮬(Phaser와 분리), 결정론 수학(dmath, Node=Chromium 비트 동일), 공명침 3개, 공명선(거리/LOS), 서명 포획(Impact/Wave/Heat/Void/Rotational), 방향성 Pulse(역류·역위상), Lattice, Moving Anchor, Shield 2→1→Core, 회복 1회, 동시 판정(tie=사망), Thread Step.
- 보스 9체: B01~B08 + FINAL(3단계) 모두 Seal 기반, 보스별 다른 Convergence. 입력 프레임만 쓰는 fixture 봇이 **튜닝 0개·일반 규칙(실드 디버그 없음)**으로 전부 처치.
- 월드: 심장 봉인실(학습 장치, 권역문 4, 심장문, 제단, 기록비), 4권역 × 2보스, 권역마다 공명 게이트 퍼즐 1개, 처치 후 환경 변화.
- 진행: 서로 다른 5보스 → 심장문 1회 개방, 튜닝 8종(최대 2 장착, 공격력 없음), 기록/재도전(타임어택), 보스 러시(P2), 엔딩 → 타이틀 → 이어하기.
- 저장: 버전드 localStorage, 경계 시점에만 기록, 손상 데이터 sanitize.
- UI: 한국어 전 화면, UI 100/125/150%, 설정(볼륨 7버스, 흔들림, 번쩍임, 고대비, 느린 모드, 전체 화면, 조준 감도, 데드존, 진동, 키 재설정).
- 렌더: 정수 줌 + 디바이스 픽셀 정렬, 마스터 팔레트 정확(블러/번짐/서브픽셀 0).
- 배포: `dist/` 상대 경로, 일반 정적 서버·하위 경로에서 동작.

## AutoVerified (npm run test — 5 files, 74 tests)
- tests/resonance.test.ts: A01~A15 프레임워크 규칙
- tests/bosses.test.ts: A16 (9보스, 튜닝 0, **일반 Shield/Core 규칙**), A15 보스별 결정론, B01 규칙
- tests/progression.test.ts: A17 저장 왕복/손상 데이터, 5보스 게이트, 튜닝 효과·상한(탄성 반사, 안정망, 잔향), Thread Step
- tests/world.test.ts: 도보 이동 경로, 권역 게이트, 심장문
- tests/dmath.test.ts: 결정론 수학 + 골든 지문

## RuntimeVerified (npm run test:e2e — 14 tests, production bundle)
- E01 신규 플레이(사망→재도전 < 2.5 s→처치→reload), E02 침 불변식(프레임 감시 위반 0), E03 방향성 Pulse
- E04 도보로 8보스 전부 **실드 디버그 없이** 처치, 심장문은 5번째 서로 다른 보스(B04)에서 정확히 1회
- E05 FINAL A→B→C → 엔딩 → 타이틀 → 이어하기 → 재도전, 보스 러시 9연전(기록 저장)
- E06 boot/입력/오디오 unlock/가상 게임패드/blur/저장·reload/리사이즈/전체 화면, A20 일반 Node 정적 서버 + 하위 경로
- A21 픽셀 정확성 1x~4x(hub/B01/FINAL) + 전 권역·보스 갤러리, perf(50회 reset 누수 0, 1080p 프레임 시간)
- A19 UI 스케일: 3 해상도 × 3 배율 × 15 화면 = 135 화면, 이슈 0 (ui-scale.json에 화면별 검사 요소 수·스크롤 probe·키보드 nav 단계 기록) + 검사기 self-test(주입 결함 전 종류 검출, 스크롤로 도달 가능한 항목은 미보고)

## VisualVerified
- 작은 미리보기로 확인: 150% 설정(3열), 1920x1080@150% 타이틀, 튜토리얼 힌트, 튜닝 제단/기록비(균일 폭 버튼, 단일 포커스), B04/B07 전투 화면. 전체 아트 검수는 아님.

## 현재 실패
- 없음 (마지막 전체 실행 기준).

## Blocked / ManualQARequired
- A22/A23 아트 품질·실루엣·재질 가독성: 자동 검사(팔레트, 픽셀 밀도, 누락 시트 0)는 통과, 사람 검수 필요.
- 실제 GPU 프레임 시간(측정은 headless SwiftShader), 실물 게임패드(가상 패드로만 검증), HTTPS 호스팅(HTTP만 검증), 음향 믹스 청취.
- 번쩍임/흔들림/고대비/느린 모드 설정의 렌더 효과는 전용 자동 검사 없음(코드로 연결 확인).

## 결정 기록
- 2026-09-27 튜토리얼 힌트 위치: 스펙 §28 "화면 하단" 대신 **상단 중앙(지역명 카드 아래)** 으로 확정(권장안 채택).
  이유: 학습 장치 방이 맵 하단 끝이라 카메라가 플레이어를 화면 하단 12% 지점에 두므로, 하단 힌트는 플레이어·방사파·앵커판을 가린다.
  힌트는 여전히 짧은 문구만(§28 취지 유지). 구현: `src/ui/styles.css` `.hint-bar`, 검증: A19 hub-tutorial 9조합 이슈 0.

## 다음 우선순위
1. 사람의 아트/사운드 QA 결과 반영 (A22/A23).
2. 실제 브라우저·GPU·게임패드로 수동 플레이테스트, TUNABLE 조정.
3. P2 확장(변형 규칙, 챌린지)은 범위 밖.

## 이번 세션 변경 (2026-09-27)
- UI 스케일 검사기 재작성(e2e/ui_scale.spec.ts): 스크롤 패널 자식을 통째로 건너뛰던 방식(오탐 회피용이었으나 실제 잘림도 숨김) → 스크롤 도달성(범위·패널보다 큰 항목·실제 스크롤 probe) + 텍스트 넘침/잘림/부모 이탈/내용·버튼 겹침/HUD 판 겹침/키보드 포커스 가시성/레이어 스크롤 검사. 2560x1440과 타이틀·확인·기록비·튜닝·일시정지·HUD·토스트·프롬프트·튜토리얼·사망·승리·엔딩 화면 추가.
- 검사기가 찾은 실제 결함 수정: 150% 설정 화면 마지막 행이 [돌아가기] 버튼 밑으로 겹침 → 3열(소리 | 화면+조작 | 키 설정) + 열 영역만 스크롤; 1920x1080@150% 타이틀 세로 넘침 → 로고는 UI 배율과 무관(--u0); 튜토리얼 힌트가 지역명 카드와 겹침 → 카드 아래로.
- 목록 패널 버튼 균일 폭, 포인터 hover가 메뉴 포커스를 옮김(강조 항목 1개), 번쩍임 설정을 보스 피격 점멸·플레이어 무적 점멸에 적용(끄면 점멸 대신 고정 디더).
- 봇: 회피 방향이 다른 위협으로 들어가면 안전한 방향 선택(safeHeading), B05 봇은 조준 투사체 사전 회피(dodgeShots) → B03/B05도 실드 디버그 없이 처치. A16/E04를 일반 규칙으로 강화.
- 테스트 추가: tests/progression.test.ts, A20 정적 서버 테스트, 보스 러시 E2E. F4 디버그에 충돌 t 표시.

## 핵심 설계 결정 (compaction 후 참고)
- Stack: TypeScript 7.0.2 strict (erasableSyntaxOnly, .ts import), Phaser 4.2.1, Vite 8, Vitest 5, Playwright 1.63.
- Sim: `src/core/sim/sim.ts` 1 Sim = 1 area/arena 시도. 재도전 = 새 Sim. 60Hz fixed step. 수학은 `src/core/math/dmath.ts`(엔진 독립).
- Pulse(E): 커서에 가장 가까운 (충전 선이 있는) embedded 침 = 목표, 연결된 충전 선 전부가 목표로 흐름. `sim.flowInverted`/`sim.invertedLinks` 로 역류 방향 반전(B05 썰물, FINAL Phase B).
- Boss 인터페이스 `src/bosses/framework/boss.ts`, 등록 `src/bosses/registry.ts`, arena `src/world/areas/arenas.ts`, 뷰 `src/presentation/bosses/*View.ts`, 아트 `art/source/boss*.ts`, 봇 `src/debug/bots/*Bot.ts`.
- 봇: 입력 프레임만 생성 (A16 fixture). `botKit.ts`: Placer, survive(회피 + safeHeading), dodgeShots(선택형), threat().
- 헤드리스 봇 디버그: `node tests/scratch.ts B0x [invuln]`.
- UI 레이아웃: `--u`(UI 배율 포함), `--u0`(배율 제외, 로고), `--ps`(정수 픽셀 프레임 배율). 화면 추가 시 e2e/ui_scale.spec.ts `oneSize()`에 넣을 것.

## 보스 요약
- B01 그람(quarry): 돌진 Impact 포획 → 봉인석 면 방향 → 코어 소켓 + 격자 pin → 코어로 역류.
- B02 허밍(belfry): 음높이 0/1/2 Wave → 같은 음 종, 틀린 종 = 불협(이중 링) → 추(TemporaryAnchor) + 화음.
- B03 네라(marsh): 4 분신, 진짜만 굴절/부착. Heat, 등 뒤 Heat, Overloaded Heat → 본체를 격자에 가두고 Heat.
- B04 모라(garden): 도관 연결 + slam 포획 → 뿌리끝 MovingAnchor → fork-in → 심장.
- B05 역조의 눈(marsh): 뗏목(이동) + 고정점, 평면파는 평행일 때만 포획, 조류 반전, 눈꺼풀/누관/동공.
- B06 브락(quarry): 박힌 침을 삼킴(내부 이동 소켓) → 나머지 두 침과 연결해 내부 봉인 역류.
- B07 아르/오르(garden): 반대 궤도 두 몸이 하나의 회로, 충/합/구(180°/0°/90°)에서 Rotational → 중앙 받침대.
- B08 무언의 왕관(belfry): 최근 공명망을 읽는 결정론 상태기계(긴 선→절단, 작은 삼각→압박, 부착→방출), 대응 직후 보석으로 같은 에너지.
- FINAL 닫힌 별: A 회전 단자 링 회로 3개(Heat), B 역위상 선(모양·움직임으로 표시), C 무선 상태(움직이는 파편 3점 격자) → 엔딩.

## 변경한 TUNABLE
- dashIFrames 0.10 → 0.12 (링 대시 통과 여유). 이번 세션 게임 수치 변경 없음(봇·UI·검사만).

## 재현 명령
- `npm run art` / `npm run typecheck` / `npm run test` / `npm run build` / `npm run test:e2e` / `npm run verify`
- UI 스케일만: `npx playwright test e2e/ui_scale.spec.ts` (약 5분)

## 마지막 clean checkpoint
- 커밋 8217db2 (B07/B08/FINAL). 그 이후 작업(E01~E06, 결정론 수학, UI 스케일, 이번 세션 변경)은 **미커밋** 작업 트리에 있음.
