# 공명선: 봉인된 심장 — TypeScript 웹 2D 픽셀아트 보스 퍼즐 액션 원샷 개발 프롬프트

이 문서는 **단독 실행 가능한 제품 명세이자 구현 프로토콜**이다. 외부 기획서나 특정 상용 게임의 코드·맵·아트·보스 데이터를 전제로 하지 말고, 이 문서 하나를 canonical specification으로 사용해 프로젝트 초기화 → 구현 → 실행 → 테스트 → 수정 → 완주 → production 정적 빌드 검증까지 수행하라.

이 게임은 “짧은 탐색 + 보스 중심 + 관찰을 통한 공략 발견 + 실패 후 빠른 재도전”이라는 장르적 장점만 참고한다.

다음 요소는 **의도적으로 사용하지 않는다.**

- 플레이어 1HP
- 단 하나의 화살
- 화살 발사 후 회수만 반복하는 전투
- 약점 한 발 = 즉사라는 전 보스 공통 규칙
- Titan Souls의 보스 구조·맵·세계관·리소스·연출 복제

대신 이 게임의 고유한 전투 정체성은 다음이다.

> **3개의 공명침을 arena와 보스에 박아 공명선을 만들고, 보스 공격이나 환경 에너지를 선에 받아 저장한 뒤, 원하는 방향으로 역류시켜 봉인을 깨뜨리는 보스 퍼즐 액션.**

전투의 기본 사고 순서는:

```text
관찰
→ 공명침 배치
→ 공명선 구성
→ 보스 공격 유도
→ 에너지 포획
→ 역류 방향 선택
→ 봉인 파괴
→ 새로운 상태 진입
→ 마지막 핵 공명
```

게임은 HP를 깎는 DPS 경쟁이 아니라 **공간 배치·공격 유도·타이밍·선형 기하·상태 전환**을 이해하는 전투를 지향한다.

---

# 0. 실행 계약

## 요구 등급

- **LOCKED**: 깨지면 핵심 정체성이나 판정 일관성이 무너지는 불변 규칙.
- **TUNABLE**: 이동속도, 공명침 속도, 선 길이, 공격 간격, 보호막 수치, 카메라 흔들림 등 플레이테스트로 조절할 값.
- **CREATIVE**: 세부 맵 형태, 보스 외형, 장식, 색 조합, 미세 애니메이션, 환경 스토리텔링 등 제품 방향을 해치지 않는 범위에서 구현자가 결정할 영역.

## 구현 우선순위

- **P0 — Core Vertical Slice**: 이동 → 공명침 3개 → 공명선 → 공격 에너지 포획 → 역류 → 봉인 1개 파괴 → 피격/사망 → 빠른 재도전.
- **P1 — Complete Game**: 중앙 성역, 4개 권역, 보스 8체, 최종 보스, 진행/저장, 한국어 UI, 기록, 접근성, 엔딩.
- **P2 — Expansion**: 추가 보스, 변형 규칙, 타임어택, 챌린지, 보스 러시, 추가 공명 조율.

## 전역 원칙

1. authoritative gameplay state는 TypeScript 코어 계층에 둔다.
2. 엔진 Sprite/Scene/Particle/Audio가 직접 봉인, 보호막, 진행 상태를 변경하지 않는다.
3. fixed-step simulation과 렌더링을 분리한다.
4. 충돌 결과는 실제 geometry와 명시된 우선순위로 결정한다.
5. 보스 패턴은 학습 가능하고 재현 가능해야 한다.
6. 테스트를 통과시키려고 제품 요구를 약화하지 않는다.
7. `Implemented`와 `Verified`를 구분한다.
8. 사망 후 긴 이동이나 로딩으로 실패를 벌주지 않는다.
9. 플레이어가 죽었을 때 이유를 이해할 수 있어야 한다.
10. P1 완성 전에 범용 프레임워크를 과하게 만들지 않는다.

검증 상태:

```text
NotStarted | InProgress | Implemented | AutoVerified | RuntimeVerified | VisualVerified | ManualQARequired | Blocked | Failed
```

---

# 1. 원샷 AI 행동 지침

환경과 저장소 지침을 확인한 뒤 **실제 구현을 시작하라.**

계획만 작성하고 끝내지 않는다. 사소한 미정사항은 CREATIVE/TUNABLE 범위에서 결정한다.

현재 Stage Gate에 차단되지 않은 필수 항목이 남아 있으면:

```text
구현 → 관련 테스트 → 실제 브라우저 실행 → 실패 원인 수정 → Gate 재검증
```

을 계속한다.

긴 작업에서는 `ProjectState/`를 갱신한다.

## Claude Opus 5.5 사용 시

- 저장소 파일을 열기 전에 코드에 대해 추측하지 않는다.
- 관련 구현을 먼저 읽고 기존 구조를 재사용한다.
- Stage 단위로 완결 가능한 작업을 끝낸다.
- 작은 수정마다 전체 회귀를 반복하지 않는다.
- 관련 테스트 → Stage Gate → 최종 전체 검증 순으로 수행한다.
- 독립적인 조사/테스트만 병렬화한다.
- 같은 파일을 여러 subagent가 동시에 수정하게 하지 않는다.
- 테스트를 통과시키기 위한 fixture 전용 하드코딩을 금지한다.
- 막힌 문제는 증상 패치보다 root cause를 먼저 찾는다.
- 사용자에게는 실제 변경·실행 결과 중심으로 짧게 진행 상황을 보고한다.
- 모델 설정을 제어할 수 있다면 adaptive thinking을 사용하고 기본 effort는 `medium`을 권장한다.
- 더 높은 effort는 복잡한 구조 변경, 장기 디버깅, 원인 불명 회귀에서만 사용한다.

---

# 2. 제품 정의

**게임명:** 「공명선: 봉인된 심장」  
**영문 가제:** `Resonant Lines: Sealed Hearts`

**장르:** 한국어 싱글플레이 2D 탑다운 픽셀아트 보스 퍼즐 액션.

플레이어는 폐허가 된 봉인 시설을 탐험하는 이름 없는 조율자다.

무기는 활이나 총이 아니다. 플레이어는 **공명침 3개**를 공간에 박아 선을 만들고, 거대한 생명체의 공격 자체를 에너지로 포획해 되돌려 보낸다.

보스는 “피해를 얼마나 많이 넣느냐”보다 “어떤 공격을 어디에서 받아 어떤 방향으로 돌려보내느냐”로 무너진다.

대사는 거의 없다. 세계관은 공간 구조, 벽화, 오래된 공명 장치, 보스의 행동, 보스 처치 후 변하는 지역, 음악/환경음, 짧은 지역명·보스명, 엔딩의 시각 연출로 전달한다.

긴 NPC 대화, 퀘스트 설명, 수집형 장문 문서는 P1에 넣지 않는다.

## 목표 플레이

- 첫 완주: **90~150분**
- 보스 1회 시도: **30초~4분**
- 사망 → 재도전: **2.5초 이내 목표**

보스를 처음 만났을 때 플레이어의 학습은 다음 흐름이어야 한다.

```text
이 공격을 피해야 한다
→ 공격이 공명선을 통과하면 선이 변한다
→ 이 에너지를 저 봉인에 보내면 되는구나
→ 침 위치를 이렇게 둬야 한다
→ 이제 실행
```

---

# 3. 진행 구조

```text
타이틀
→ 중앙 봉인실
→ 4개 권역 개방
→ 권역마다 2보스
→ 임의의 5보스 처치
→ 중앙 심장문 활성화
→ 최종 보스
→ 엔딩
→ 보스 재도전 / 타임어택 / 전체 보스 러시
```

모든 보스를 강제하지 않는다. 보스 처치마다 공격력을 높이지 않고 선택 가능한 **공명 조율(Tuning)**을 해금한다. 모든 보스는 기본 상태에서도 처치 가능해야 한다.

---

# 4. 기술 스택

## 언어

**TypeScript `strict` 고정.**

핵심 게임 규칙을 JavaScript 우회 코드로 따로 만들지 않는다.

## 2D 엔진

외부 웹 2D 게임 엔진/렌더링 라이브러리를 허용한다.

기본 추천:

```text
Phaser 4 + Vite
```

허용 후보:

```text
Excalibur.js
PixiJS + 자체 game loop/collision/scene 계층
기타 성숙한 TypeScript 친화적 웹 2D 엔진
```

특별한 이유가 없으면 Phaser 4를 기본으로 한다.

엔진 선택 기준:

- TypeScript 친화성
- sprite / animation / tilemap
- camera
- pointer + keyboard + gamepad
- audio
- WebGL/Canvas
- 정적 웹 배포
- 안정적인 resize/fullscreen
- 테스트 가능한 구조

게임 규칙은 엔진 객체보다 순수 TypeScript 상태/함수에 둔다.

## 도구

```text
Vite
Vitest
Playwright
IndexedDB 또는 localStorage
```

## 필수 명령

```text
npm run dev
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run preview
npm run verify
```

---

# 5. 권장 프로젝트 구조

```text
src/
  core/
    clock/
    ids/
    math/
    geometry/
    rng/
    events/

  player/
    movement/
    guard/
    state/

  resonance/
    needle/
    link/
    capture/
    pulse/
    lattice/

  bosses/
    framework/
    definitions/
    behaviors/

  world/
    regions/
    arenas/
    checkpoints/
    interactables/

  progression/
    unlocks/
    tunings/
    records/

  save/
  presentation/
  ui/
  localization/
  audio/
  debug/

tests/
e2e/
public/
ProjectState/
```

`GameState = 판정의 진실`, `Presentation = 보여주는 것`, `Input = 사용자 의도`, `Audio = 들려주는 것`으로 분리한다.

---

# 6. 고품질 픽셀아트 아트 디렉션 및 렌더링

픽셀아트는 단순한 저해상도 렌더 옵션이 아니라 **최종 제품 품질의 핵심 요구사항**이다.

P0 개발 중에는 임시 도형·단색 placeholder를 사용할 수 있지만, P1/Release Candidate에서 화면에 보이는 핵심 자산을 placeholder 상태로 남겨서는 안 된다.

## LOCKED-ART01 — 진짜 픽셀아트

다음 방식은 최종 자산으로 인정하지 않는다.

- 고해상도 일러스트를 축소하고 nearest-neighbor만 적용한 가짜 픽셀아트
- 벡터 도형에 pixelated CSS만 적용한 결과
- 부드러운 브러시/반투명 anti-aliasing 가장자리가 섞인 sprite
- 서로 다른 pixel density를 무계획하게 혼용
- AI 생성 이미지를 그대로 축소해 픽셀아트처럼 보이게 한 자산
- placeholder 사각형/원/문자 glyph를 보스나 환경의 최종 그래픽으로 유지

최종 자산은 **픽셀 단위로 읽히는 형태, 의도된 cluster, 제한된 색, 수작업에 준하는 edge 정리**를 가져야 한다.

## 기준 해상도

```text
logical resolution: 640×360
base tile:          16×16 px
player canvas:      약 24×32 px
small prop:         8×8 ~ 32×32 px
large prop:         32×32 ~ 64×64 px
boss:               48×48 ~ 192×192 px
UI icon:            12×12 / 16×16 / 24×24 px 계열
```

크기보다 **동일한 pixel density와 형태 언어**를 우선한다.

거대한 보스는 단순히 작은 sprite를 확대하지 말고 원래 큰 native pixel canvas에서 제작한다.

## 렌더링 불변 규칙

- nearest/point texture sampling
- integer camera zoom 우선
- camera/object render position은 가능한 한 integer pixel에 정렬
- subpixel aliasing과 shimmer 금지
- sprite rotation으로 생기는 임의의 부드러운 보간을 피하고, 필요한 회전은 discrete frame 또는 pixel-art 전용 처리 우선
- CSS scaling으로 임의의 비정수 확대를 기본값으로 사용하지 않는다
- letterbox 허용
- UI는 별도 고해상도 레이어 사용 가능
- 월드 sprite에 일반적인 bilinear filtering 금지

Phaser를 선택했다면 pixel-art 렌더 설정과 camera `roundPixels`를 명시적으로 적용하고, 카메라 follow/zoom 변경 뒤에도 이 설정이 유지되는지 실제로 검사한다.

## LOCKED-ART02 — Art Bible

Stage 1 이전에 `docs/ART_BIBLE.md` 또는 동등 문서를 만든다.

최소 포함:

```text
native resolution
tile size
player/boss pixel density
master palette
region palette variants
outline policy
highlight/shadow policy
material rendering rules
character proportion
boss silhouette rules
animation timing
VFX pixel rules
UI icon rules
forbidden visual patterns
```

코드보다 문서를 예쁘게 만드는 게 목적이 아니다.

실제 sprite/tile/VFX가 이 Art Bible을 따라야 한다.

## 팔레트

전역 master palette는 **약 24~40색**을 시작값으로 한다.

각 권역은 전역 색을 전부 바꾸는 대신:

- 공통 중성색
- 공통 공명색
- 권역별 4~8색 accent
- 보스별 1~3색 accent

를 조합한다.

원칙:

- 모든 RGB 값을 아무렇게나 새로 만들지 않는다.
- 동일 재질은 지역이 달라도 관계가 느껴지는 색군을 사용한다.
- 명암 단계는 재질별로 일관되게 유지한다.
- 검정 outline을 모든 곳에 기계적으로 두르지 않는다.
- 배경 contrast < 상호작용 대상 < 공격 telegraph < 핵심 공명 정보 순으로 시각 우선순위를 둔다.

## 픽셀 클러스터

좋은 픽셀아트의 기준은 픽셀 수가 아니라 **읽히는 cluster**다.

- 1px noise를 장식처럼 무작위로 흩뿌리지 않는다.
- 계단선은 의도적인 rhythm을 갖는다.
- 곡선은 각 구간의 pixel staircase를 정리한다.
- 작은 sprite에 불필요한 내부 디테일을 넣지 않는다.
- 큰 보스는 큰 덩어리 → 중간 형태 → 작은 accent 순으로 읽혀야 한다.
- dithering은 재질/광량 표현에 실제 이유가 있을 때만 제한적으로 사용한다.
- outline 두께가 같은 sprite 내부에서 이유 없이 1px/2px로 흔들리지 않게 한다.

## 실루엣

플레이어와 각 보스는 단색 silhouette만 보아도 구분 가능해야 한다.

보스 8체는 다음을 색만 바꾸어 재사용하지 않는다.

```text
body proportion
mass distribution
limb count/shape
movement profile
negative space
anchor socket 위치
attack pose
```

공명침이 박힐 수 있는 부위와 위험 부위는 **형태 자체로도** 구별 가능해야 한다.

## 재질 표현

최소한 다음 재질은 서로 다른 pixel language를 갖는다.

```text
stone
weathered metal
glass/crystal
water
roots/organic matter
cloth
resonance energy
void/corruption
```

예:

- 금속: 짧고 강한 specular cluster
- 돌: 넓고 무거운 명암 덩어리
- 유리: 내부 색보다 edge/highlight 우선
- 물: 수평 리듬과 제한된 반사 프레임
- 유기체: 반복되지 않는 완만한 cluster
- 공명 에너지: 일반 재질과 겹치지 않는 명확한 pulse pattern

## 캐릭터 애니메이션

플레이어 최소:

```text
idle
walk/run
dash
needle aim
needle throw
needle recall
Pulse
shield break
death
```

기본 frame 목표는 품질에 따라 조정 가능하지만 다음 수준에서 시작한다.

```text
idle        4~6
walk        6~8
dash        3~5 + smear 선택
throw       4~6
recall      3~5
Pulse       5~8
death       6~10
```

프레임 수를 채우려고 거의 같은 frame을 복제하지 않는다.

중요한 건:

- key pose
- anticipation
- contact
- follow-through
- recovery

가 픽셀 수준에서도 읽히는 것이다.

## 보스 애니메이션

각 보스는 최소 다음을 명확히 구분한다.

```text
idle/breathing
locomotion 또는 stance
attack anticipation
attack active
attack recovery
Seal break reaction
Core exposed
defeat
```

보스의 공격 telegraph는 색 flash 하나에 의존하지 않는다.

**형태 변화 + motion + VFX/음향 중 최소 2개 채널**을 사용한다.

## 픽셀 VFX

VFX도 픽셀아트다.

금지:

- 고해상도 blur particle
- soft gaussian glow를 sprite 위에 과도하게 덮기
- 화면 전체 bloom으로 pixel edge를 뭉개기
- subpixel particle drift 때문에 발생하는 shimmer
- 무작위 원형 particle만 뿌려 “화려함”을 대신하기

권장:

- 짧은 pixel shard
- 1~3px spark cluster
- discrete ring
- hand-authored impact frame
- stepped trail
- palette-shift flash
- 제한된 screen shake

공명선과 Pulse는 화려해도 **geometry를 읽는 기능**을 먼저 유지한다.

## 환경 아트

각 권역은 색만 바꾼 tilemap이 아니어야 한다.

권역마다 최소 다음이 다르다.

```text
ground cluster language
wall silhouette
prop family
anchor design
foreground framing
ambient animation
material distribution
palette accent
```

중앙 봉인실도 단순 메뉴 공간이 아니라 게임의 art-quality 기준점이 되어야 한다.

## 타일 반복감 억제

- 동일 16×16 tile의 노골적인 반복을 피한다.
- base tile + edge/corner + detail overlay + decal 조합을 사용한다.
- 큰 면은 2×2/3×3 macro variation을 둔다.
- 랜덤 노이즈 배치 대신 의미 있는 균열, 물때, 뿌리, 파편 패턴을 사용한다.
- 충돌 geometry와 시각 tile 경계가 모순되지 않게 한다.

## UI와 월드의 스타일 통일

한국어 UI는 가독성 때문에 고해상도 렌더를 허용하지만, 프레임과 아이콘은 월드의 픽셀아트 언어를 따른다.

- 과도한 현대식 glassmorphism 금지
- 둥근 SaaS 카드 UI 금지
- 픽셀 프레임/아이콘과 읽기 쉬운 한글 텍스트 조합
- focus/hover/disabled 상태를 색만으로 구분하지 않음
- UI 장식이 실제 버튼보다 더 강하게 튀지 않음

## 자산 제작 파이프라인

권장 source:

```text
art/source/**/*.aseprite
art/source/**/*.ase
```

export:

```text
public/assets/sprites/**/*.png
public/assets/tiles/**/*.png
public/assets/fx/**/*.png
```

애니메이션은 sprite sheet 또는 atlas로 내보낼 수 있다.

가능하면 Aseprite 또는 동등한 pixel editor에서:

- layer
- frame
- tag
- pivot 기준
- palette
- animation duration

을 보존하고, export 자동화를 둔다.

P1 이후에는 source asset과 runtime export 사이의 재현 가능한 경로를 유지한다.

## 고품질 기준 샘플

Stage 2가 끝나기 전 최소 다음을 **최종 품질에 가까운 대표 자산**으로 만든다.

```text
player full animation subset
B01 boss
B01 arena tiles/props
resonance needle/link/Pulse VFX
Shield break
한국어 HUD frame/icon
```

나머지 게임의 미술은 이 vertical slice의 품질을 기준으로 맞춘다.

“나중에 예쁘게 바꾸기”만 적어놓고 전체 P1을 placeholder로 구현한 뒤 끝내지 않는다.

## 시각 QA

각 주요 화면은 최소 다음을 확인한다.

```text
native 640×360
1280×720
1920×1080
2560×1440
windowed resize
fullscreen
```

확인 항목:

- 픽셀 edge blur 없음
- 비정수 scaling shimmer 없음
- camera scroll 중 sprite 떨림 없음
- outline/cluster 깨짐 없음
- sprite sheet frame bleeding 없음
- 투명 가장자리 halo 없음
- boss silhouette 가독성
- 공격 telegraph 가독성
- 공명선과 배경 분리
- 한국어 UI와 월드 스타일 조화

---


# 7. 핵심 시스템 — 공명침 3개

## LOCKED-R01

플레이어는 항상 최대 **3개의 공명침**을 가진다.

```text
Needle A
Needle B
Needle C
```

각 상태:

```text
Held
Flying
EmbeddedWorld
EmbeddedBoss
Disabled
Returning
```

동시에 4번째 공명침이 생성되면 버그다.

## 기본 조작

```text
WASD/방향키     이동
마우스          조준
LMB             선택 공명침 발사
Q/휠            공명침 선택
RMB             선택 침 회수
R               전체 침 회수
E               공명 역류/Pulse
Shift/Space     회피
Esc             일시정지
```

게임패드:

```text
Left Stick      이동
Right Stick     조준
RT              발사
LB/RB           침 선택
LT              회수
Y               전체 회수
X               Pulse
A               회피
Start           일시정지
```

---

# 8. 공명선

## LOCKED-R02

두 개의 공명침이 유효한 표면에 박혀 있고 다음 조건을 만족하면 두 침 사이에 공명선이 생긴다.

```text
distance <= maxLinkDistance
line of sight valid
두 침 모두 Disabled 아님
```

3개 침이 모두 유효하면 최대:

```text
AB
BC
CA
```

3개 선을 만들 수 있다.

기본 `maxLinkDistance = 180px`에서 시작한다.

공명선 자체는 기본 공격이 아니다.

역할:

- 보스 공격 에너지 포획
- 환경 에너지 전달
- Pulse 경로
- 보스 봉인 상호작용
- 특정 투사체 굴절
- 이동 경로 설계

---

# 9. 에너지 포획

## LOCKED-R03

보스 공격 중 일부는 `ResonanceSignature`를 가진다.

```text
Impact
Wave
Heat
Void
Rotational
```

이것은 RPG 속성 상성이 아니라 공격 행동 특성이다.

예:

```text
돌진       → Impact
음파       → Wave
지속 광선   → Heat
공간 삭제   → Void
회전 칼날   → Rotational
```

공명선이 유효 공격과 교차하면 해당 signature를 포획할 수 있다.

선 상태:

```text
Idle
Charging
Charged
Overloaded
Broken
```

- 한 선은 기본적으로 signature 1개 저장.
- 같은 에너지를 반복 포획하면 과충전 가능.
- 과충전은 강한 효과와 파괴 위험을 동시에 가진다.
- 보스마다 필요한 signature는 패턴과 환경에서 추론 가능해야 한다.

---

# 10. Pulse — 방향성 역류

## LOCKED-R04

`E`로 현재 활성 선의 저장 에너지를 방출한다.

Pulse에는 방향이 있다.

```text
A ---- B

A → B
B → A
```

두 방향의 결과가 다를 수 있다.

효과:

- 봉인 파괴
- 장갑 방향 회전
- 공격 반전
- arena 장치 활성화
- 보스 행동 중단
- 부위 고정
- 이동 플랫폼 변화
- 최종 핵 공명

공략의 핵심 질문은 항상 다음 중 하나 이상이다.

```text
무슨 에너지를 받을 것인가?
어디에서 받을 것인가?
어느 방향으로 보낼 것인가?
언제 방출할 것인가?
```

---

# 11. 삼각 공명망

3개 침이 삼각형을 만들면 `Lattice`가 형성될 수 있다.

```text
   A
  /  B---C
```

용도:

- 특정 공간 봉인
- 보스 이동 범위 제한
- 투사체 분리
- 중앙 핵 안정화
- 두 signature의 조합

하지만 모든 보스를 `삼각형 → Pulse → 끝`으로 만들지 않는다.

공명 시스템은 공통 언어일 뿐, 보스별 문제는 달라야 한다.

---

# 12. 플레이어 생존 — Shield/Core

## LOCKED-P01

플레이어 1HP 규칙을 사용하지 않는다.

기본:

```text
Shield 2
Shield 1
Core
Dead
```

일반 유효 피격:

```text
Shield 2 → Shield 1
Shield 1 → Core
Core → Dead
```

보스의 명시된 `Crush/Lethal` 공격은 Core까지 즉시 파괴할 수 있다.

## 전투 중 복구

아이템 회복 없음.

대신:

```text
공명 역류 2회 정상 성공
→ Shield 1단계 복구 가능
```

보스전당 최대 1회.

목적:

- 실수 한 번으로 학습이 끊기는 문제 완화
- 공명 시스템을 적극적으로 쓰는 플레이 보상
- 여전히 긴장감 유지

피격 후 약 0.65초의 재피격 방지와 명확한 shield-break 피드백을 준다.

---

# 13. 이동 + Thread Step

시작값:

```text
moveSpeed       = 108 px/s
dashSpeed       = 245 px/s
dashDuration    = 0.20 s
dashCooldown    = 0.42 s
iFrame          = 약 0.10 s
```

## Thread Step

Dash 중 자신의 활성 공명선을 통과하면 `Thread Step` 발동.

효과:

- dash 남은 거리 소폭 연장
- 해당 선 charge 안정화
- 짧은 afterimage
- 동일 선 연속 발동 쿨다운

Thread Step 없이도 모든 일반 보스를 처치 가능해야 한다. 숙련 플레이와 타임어택에서 가치가 커진다.

---

# 14. 공명침 물리

고속 공명침은 point overlap만 사용하지 않는다.

각 fixed step:

```text
previousPosition → nextPosition
```

swept segment로 실제 첫 충돌을 구한다.

후보:

```text
arena wall
valid anchor surface
boss body
boss anchorable armor
forbidden collider
interactive mechanism
```

가장 작은 유효 collision `t`를 처리한다.

렌더 FPS가 판정에 영향을 주지 않는다.

---

# 15. Anchor Surface

표면 태그:

```text
Anchorable
NonAnchorable
BossAnchorable
TemporaryAnchor
MovingAnchor
HazardAnchor
```

보스 부위에 박힌 침은 대미지가 아니라 **움직이는 endpoint**가 된다.

예를 들어 보스 팔에 Needle A가 박혀 있으면 팔 이동에 따라 공명선 끝점도 움직인다.

이 기능을 최소 3개 보스에서 실제 공략으로 사용한다.

---

# 16. 공명선 geometry

공명선과 다음의 교차를 연속적으로 검사한다.

- 보스 공격 segment
- 보스 body path
- moving hazard
- arena mechanism
- player Thread Step

필요하면 broad phase + exact segment intersection을 사용한다.

단순 sprite overlap을 선 교차 판정으로 쓰지 않는다.

같은 step에 여러 이벤트가 있으면:

```text
continuous collision t
→ 명시적 event priority
→ stable object ID
```

순으로 deterministic 처리.

---

# 17. 보스 생존 — HP 대신 Seal

## LOCKED-B01

보스는 전통적인 HP bar를 갖지 않는다.

대신 `Seal` 상태를 가진다.

예:

```text
Seal A
Seal B
Seal C
Core
```

보스별 Seal은 2~4개 권장.

Seal은 “3번 때리기”가 아니다.

예:

```text
Seal A = Impact를 후방으로 역류
Seal B = Wave를 종 장치에 전달
Seal C = moving anchor 두 개 연결
Core = 노출 상태에서 Convergence
```

각 Seal은 다른 관찰과 실행을 요구해야 한다.

---

# 18. 최종 처치 — Convergence

필수 Seal이 깨지면 `CoreExposed`.

종결 방식은 보스별로 다를 수 있다.

- 정확한 directional Pulse
- Lattice 내부에 Core를 가둔 뒤 Pulse
- 두 이동 부위 사이 link를 만든 뒤 역류
- 마지막 공격을 재포획해 반사
- arena node 3개 동기화

**모든 보스를 “봉인 깨고 약점 한 발”로 끝내지 않는다.**

---

# 19. 동시 판정

Convergence와 플레이어 lethal hit가 거의 동시에 발생할 수 있다.

각 collision의 substep `t`를 비교한다.

```text
Convergence t < lethal t → boss completion
lethal t < Convergence t → player death
same within epsilon → player death priority
```

tie rule은 LOCKED.

---

# 20. 보스 공통 설계 양식

각 보스는 다음을 문서화한다.

```text
핵심 질문
주요 공격
포획 가능한 signature
침을 어디에 박을 수 있는가
어떤 선 구성이 필요한가
봉인 A 조건
봉인 B 조건
선택 봉인/숙련 루트
Core 노출 조건
Convergence 방법
실패 피드백
숙련 단축 루트
```

---

# 21. P1 보스 8체

## B01 — 벽쇄자 그람

역할: 기본 시스템 학습.

핵심 질문:

> 돌진을 피하기만 하지 말고 공명선에 통과시키면?

- 사각 arena.
- 벽 네 군데 Anchorable 석판.
- 보스 직선 돌진 = `Impact`.

공략:

1. A/B로 돌진 경로를 가로지르는 선 생성.
2. 돌진을 통과시켜 Impact 저장.
3. Pulse를 뒤쪽 봉인석으로 전달.
4. 두 다른 봉인석을 각각 다른 방향에서 파괴.
5. 보스 몸의 Moving Anchor socket을 C로 고정.
6. 짧은 Lattice로 Core 안정화.
7. Convergence.

가르침:

`배치 → 포획 → 방향성 역류`.

---

## B02 — 종루의 허밍

핵심 질문:

> 같은 에너지라도 어디로 보내느냐가 중요하다.

- 원형/부채꼴 음파.
- signature `Wave`.
- arena에 음높이가 다른 종 3개.

보스가 내는 음과 시각 파형을 읽고 대응하는 종으로 Wave를 Pulse한다.

잘못된 종은 진행 실패만 만드는 게 아니라 다음 공격 구성을 바꾼다.

음소거 플레이에서도 크기·파형·진동 애니메이션으로 구분 가능.

마지막은 움직이는 종추가 TemporaryAnchor가 된다.

---

## B03 — 거울비늘 네라

핵심 질문:

> 공명선을 센서로 쓸 수 있는가?

- 반사 분신 4개.
- 가짜 분신은 공명선을 그대로 통과.
- 진짜 본체만 공명선 geometry를 미세 굴절.

플레이어는 긴 probe line으로 본체를 찾아 Moving Anchor를 부착하고, 분신 공격을 포획해 본체 봉인에 역류한다.

공명선이 탐지 도구가 되는 보스.

---

## B04 — 뿌리기계 모라

핵심 질문:

> 보스 공격으로 arena 회로를 고칠 수 있는가?

- 중앙 고정.
- 거대한 뿌리 팔 내려찍기 = `Impact`.
- 끊어진 공명 관로 4개.

침 endpoint로 끊어진 회로를 임시 연결하고 보스 slam을 포획해 관로를 활성화한다.

올바른 회로를 켜면 다른 뿌리가 Moving Anchor로 전환된다.

같은 행동 3회 반복은 금지.

---

## B05 — 역조의 눈

핵심 질문:

> endpoint가 움직이면 선의 의미도 바뀐다.

- 얕은 물.
- 방향이 바뀌는 흐름.
- 떠다니는 anchor 플랫폼.
- `Wave`, `Impact`.

한 침을 이동 플랫폼, 다른 침을 고정점에 박아 시간이 지나며 선 각도가 바뀌게 만든다.

특정 각도에서 압력파를 포획해 눈꺼풀 봉인을 연다.

---

## B06 — 재굴착자 브락

핵심 질문:

> 자원을 빼앗기는 상황을 공략으로 바꿀 수 있는가?

- 지하 잠복.
- 설치된 침 하나를 땅속으로 끌고 감.
- 빼앗긴 침은 boss body의 temporary socket에 붙어 이동.
- 솟구칠 때 잠깐 노출.

일부러 침을 먹게 만든 뒤 나머지 두 침과 내부 endpoint를 연결해 내부 봉인을 역류시킨다.

---

## B07 — 쌍궤도 아르/오르

핵심 질문:

> 두 개체를 서로 공격 대상으로 보지 말고 하나의 회로로 볼 수 있는가?

- 두 개체가 반대 궤도로 이동.
- 각각 Needle 1개 부착 가능.
- 세 번째 침은 중앙/벽.

두 이동 endpoint 사이 선이 특정 교차각을 만들면 `Rotational` charge 생성.

중앙 anchor로 Pulse해 공유 봉인 파괴.

둘을 각각 때려 죽이는 구조가 아니다.

---

## B08 — 무언의 왕관

핵심 질문:

> 보스가 내가 만든 공명망을 읽는다면?

보스는 최근 lattice 형태에 deterministic하게 대응한다.

```text
긴 직선 위주 → 선 절단 공격 증가
작은 삼각망 → 중앙 압박
Moving Anchor 의존 → anchor eject
```

플레이어는 일부러 한 패턴을 보여 대응을 유도한 뒤 다른 형태로 전환해 역이용한다.

무작위 AI가 아니라 학습 가능한 state machine이어야 한다.

---

# 22. 최종 보스 — 닫힌 별

3단계.

## Phase A — 회로 붕괴

arena 자체가 회전한다.

고정/Moving Anchor를 조합해 끊어진 외곽 회로 3개를 연결하고, 보스 공격으로 충전한다.

## Phase B — 역위상

일부 공명선이 반전되어 Pulse 방향이 뒤집힌다.

색만으로 구별하지 말고 animation direction + particle flow + shape로 표시.

## Phase C — 무선 상태

arena의 Anchorable surface 대부분이 사라진다.

남는 endpoint:

```text
보스 몸에 박은 침
움직이는 파편
일시적 중앙 핵
```

마지막 Convergence는 움직이는 3점 geometry를 맞춰야 한다.

처치:

```text
모든 공명선 소멸
→ arena 정적
→ 침 3개 회수
→ 중앙 심장 재가동
→ 지역 색조 변화
→ 짧은 엔딩
```

긴 대사 없음.

---

# 23. 공명 조율(Tuning)

보스 처치 후 하나씩 해금. 동시에 최대 2개 장착.

공격력 증가 금지.

예:

### 긴 선

```text
maxLinkDistance +20%
chargeRate -10%
```

### 빠른 침

```text
needleSpeed +25%
recallSpeed +15%
lineStability -10%
```

### 탄성 침

```text
벽 1회 반사 후 박힘
needleSpeed -10%
```

### 안정망

```text
첫 overload에서 즉시 파괴되지 않음
Pulse cooldown +15%
```

### 잔향

```text
Pulse 후 선 0.5초 잔존
새 에너지 포획 불가
```

### 급속 조율

```text
Pulse startup 감소
Pulse width 감소
```

원칙:

- 모든 보스 tuning 없이 클리어 가능.
- tuning은 대체 풀이/숙련 루트 제공.
- 특정 tuning 없으면 진행 불가능한 구조 금지.

---

# 24. 월드

중앙:

```text
심장 봉인실
```

권역:

```text
A. 침식 정원
B. 파열 종루
C. 재의 채석장
D. 거울 습지
```

각 권역:

- 보스 2체
- 짧은 비전투 탐색
- 0~2 환경 퍼즐
- 고유 Anchor material
- 고유 ambient
- 보스 처치 후 환경 변화

---

# 25. 탐색 / 일반 적 정책

탐색은 보스 사이 완충이다.

금지:

- 일반 몹 반복 전투
- 장비 파밍
- 재료 수집
- 상점 왕복
- XP 노가다

허용:

- 숨겨진 arena
- 조율 파편
- shortcut
- 환경 퍼즐
- 시각적 세계관 단서

P1 일반 적은 기본적으로 없다.

보스 소환체는 보스 상태 일부이며 XP/전리품 없음.

---

# 26. 저장

```text
schemaVersion
discoveredBossIds
completedBossIds
unlockedRegions
unlockedTunings
equippedTunings
finalGateUnlocked
endingSeen
bossBestTimes
bossDeathCounts
fullClearBestTime
settings
bindings
```

저장 경계:

- 보스 발견
- 보스 처치
- tuning 변경
- 권역 해금
- 엔딩
- 설정

전투 중 arbitrary quicksave 없음.

---

# 27. 한국어 UI

기본 언어: `ko-KR`.

타이틀:

```text
공명선

이어하기
새 게임
기록
설정
```

사망:

```text
공명이 끊어졌다

[R] 다시 시도
[Esc] 봉인실로
```

전투 HUD:

- Shield/Core
- Needle A/B/C
- 선택 침
- Link charge
- Pulse 가능 상태
- boss seal glyph

표시 금지:

- HP bar
- DPS
- 피해 숫자
- 퍼센트 체력
- 정답 위치 직접 안내

---

# 28. 첫 플레이 학습

중앙 봉인실에 안전한 학습 장치:

- Anchor wall 2개
- harmless Wave emitter
- 봉인문 1개

사용자가 직접:

```text
침 2개 배치
→ 선 연결
→ Wave 통과
→ charge
→ Pulse
→ 문 개방
```

한다.

필요 시 화면 하단 짧은 힌트만:

```text
침 발사
선을 연결하라
공명을 받아라
역류
```

---

# 29. Localization

문자열 중앙 관리.

```ts
{
  "menu.continue": "이어하기",
  "menu.newGame": "새 게임",
  "menu.records": "기록",
  "combat.pulse": "역류",
  "combat.recall": "회수",
  "death.retry": "다시 시도",
  "boss.sealBroken": "봉인 해제"
}
```

검증:

```text
1280×720
1920×1080
2560×1440
UI 100/125/150%
```

한글 잘림, fallback 폰트 레이아웃 붕괴, 버튼 겹침을 검사.

---

# 30. 오디오 / 접근성

오디오 버스:

```text
Master
Music
Boss
Resonance
Impact
Environment
UI
```

공명선 음향:

```text
Idle        약한 hum
Charging    상승 공명
Charged     안정 tone
Overloaded  불안정 beat
Pulse       방향성 sweep
```

음향 없이도 플레이 가능하게 같은 정보를 시각 신호로 제공.

접근성:

- UI scale
- screen shake
- flash
- high-contrast resonance
- colorblind-safe signature shapes
- gamepad vibration
- aim sensitivity
- deadzone
- key remap
- audio sliders
- optional slow mode

Signature는 색만으로 구분하지 않는다.

```text
Impact     = 사각 파형
Wave       = 원형 파형
Heat       = 세로 떨림
Void       = 끊긴 선
Rotational = 나선
```

---

# 31. 디버그

```text
F1 hurtbox
F2 boss state
F3 needles/links
F4 signature capture
F5 pulse path
F6 fixed-step
F7 reset arena
F8 boss select
F9 shield debug
```

표시:

- needle collider
- link geometry
- attack swept path
- capture intersection
- Pulse direction
- seal state
- moving anchor velocity
- collision t
- simulation tick

release에서 숨긴다.

---

# 32. 자동 검증

### A01 — Needle ownership

발사/회수/사망/reset/save/load 100회 후 A/B/C 각각 하나, 총 3개 초과 0.

### A02 — Link lifecycle

두 침 조건에 따라 link 생성/해제 정확.

### A03 — Link distance

최대 거리 초과 연결 금지.

### A04 — LOS

차단 구조물을 관통해 link가 생성되지 않음.

### A05 — Swept needle collision

30/60/144 렌더 FPS에서 첫 충돌 동일.

### A06 — Capture provenance

실제로 link를 통과한 공격만 charge.

### A07 — Signature

잘못된 signature로 seal 파괴 불가.

### A08 — Directional Pulse

A→B와 B→A 결과가 정의대로 다름.

### A09 — Seal idempotency

같은 sealBreakEvent 10회 재처리해도 한 번만 commit.

### A10 — Shield

일반 피격:

```text
2 → 1 → Core → Dead
```

정확.

### A11 — Recovery limit

보스전 중 Shield recovery 최대 횟수 초과 없음.

### A12 — Same-tick tie

Convergence와 lethal hit 동시 조건 deterministic.

### A13 — Moving Anchor

이동 endpoint와 link 정확 추적.

### A14 — Arena reset

사망 후 gameplay state 잔존 0.

### A15 — Determinism

동일 seed + 입력 sequence에서 동일 boss transition.

### A16 — Tuning safety

모든 보스를 tuning 0개 상태에서 클리어 가능한 fixture 존재.

### A17 — Save/load

발견/처치/tuning/최종문/엔딩 상태 복원.

### A18 — Focus loss

window blur 후 held input 없음.

### A19 — Korean UI

주요 화면 깨짐/잘림 없음.

### A20 — Static production

`dist/` 일반 정적 HTTP(S)에서 boot/save/reload 가능.

### A21 — Pixel-perfect rendering

지원 해상도와 resize/fullscreen에서:

```text
texture blur 0
frame bleeding 0
투명 edge halo 0
camera-induced shimmer 0
```

을 확인한다.

### A22 — Art consistency

대표 player/B01/arena/UI/VFX 캡처가 `ART_BIBLE.md`의:

```text
palette
pixel density
outline
material language
silhouette
VFX rules
```

을 위반하지 않는지 시각 검수한다.

### A23 — Placeholder removal

Release Candidate에서 사용자에게 보이는 핵심 게임 자산 중 개발용 단색 도형, debug glyph, 임시 텍스트 sprite가 최종 자산으로 남아 있지 않아야 한다.

---

# 33. E2E

## E01 신규 플레이

```text
새 게임
→ 중앙 봉인실
→ 공명 학습 장치
→ 권역 이동
→ B01 발견
→ 사망
→ 빠른 재도전
→ Seal 파괴
→ Convergence
→ 처치
→ 중앙 복귀
→ reload
→ 완료 유지
```

## E02 Needle invariant

```text
3개 발사
→ 개별 회수
→ 재발사
→ 전체 회수
→ 사망
→ 재시작
```

3개 invariant 유지.

## E03 Pulse direction

같은 charge에서 A→B / B→A가 다른 target을 활성화.

## E04 Final unlock

서로 다른 5보스 완료 후 최종문 한 번 활성화.

## E05 Ending

```text
최종 보스
→ Phase A
→ Phase B
→ Phase C
→ Convergence
→ 엔딩
→ 타이틀
→ 이어하기
→ boss replay
```

## E06 Production

production build에서 boot/input/audio/save/reload/resize/fullscreen/gamepad smoke 성공.

---

# 34. 성능 목표

```text
1080p output
60fps
1~2 boss entities
3 needles
3 active links
<= 128 gameplay projectiles
<= 600 visual particles
```

측정:

- average frame time
- 1% low
- memory/GC
- 50 arena resets 후 orphan object
- resize/fullscreen 후 geometry drift

객체 풀링은 실제 병목이 확인된 대상부터 적용.

---

# 35. Stage / Gate

## Stage 0 — Bootstrap

- 저장소/지침/Git 확인
- TypeScript strict
- 2D 엔진
- Vite/Vitest/Playwright
- canvas boot
- 한국어 font fallback
- `docs/ART_BIBLE.md` 초안
- pixel rendering 설정
- 대표 palette/asset 규격 확정
- ProjectState

**Gate 0**

```text
typecheck PASS
unit smoke PASS
build PASS
browser boot PASS
```

## Stage 1 — Resonance Sandbox

- 이동/dash
- Needle A/B/C
- 발사/회수
- 2점 link
- 3점 lattice
- capture
- directional Pulse
- Shield/Core
- debug

**Gate 1**

```text
A01~A12 핵심 PASS
5분 sandbox
needle duplication 0
link orphan 0
NaN 0
```

## Stage 2 — First Boss

B01 완성.

```text
arena
→ 돌진 관찰
→ 침 배치
→ Impact 포획
→ Pulse
→ Seal
→ Convergence
→ 처치
```

**Gate 2**

- 자동 테스트
- 실제 브라우저 플레이
- 사망 후 2.5초 내 재도전
- 외부 공략 없이 핵심 규칙 추론 가능
- 플레이어 + B01 + arena + 공명 VFX를 **최종 품질에 가까운 픽셀아트 vertical slice**로 완성
- placeholder가 아니라 이후 전체 자산의 품질 기준으로 사용

## Stage 3 — World + 4 Bosses

- 중앙 봉인실
- 4권역
- B01~B04
- checkpoint
- save/load
- 한국어 메뉴/설정/기록

**Gate 3**

```text
새 게임
→ 4보스 발견
→ 최소 2보스 처치
→ reload
→ 정확 복원
```

## Stage 4 — Full Boss Set

B05~B08.

서로 다른 핵심 질문:

```text
moving geometry
resource loss
relative geometry
deterministic counterplay
```

**Gate 4**

색/속도/봉인 위치만 바꾼 복제품 0.

## Stage 5 — Final Boss

```text
5보스 완료
→ 심장문
→ 닫힌 별
→ 3단계
→ 엔딩
→ replay
```

**Gate 5**

처음부터 엔딩까지 실제 E2E 완주.

## Stage 6 — Release Candidate

- typecheck
- unit/integration
- Playwright E2E
- 3해상도
- UI scale
- 한국어
- Art Bible 준수 시각 QA
- 전체 핵심 sprite/VFX placeholder 제거
- pixel blur / shimmer / frame bleeding / halo 검사
- boss silhouette / telegraph / material 가독성 검수
- gamepad
- audio unlock
- static build
- memory
- 50회 reset
- boss replay
- save/reload

---

# 36. ProjectState

```text
ProjectState/
  feature_list.json
  acceptance_results.json
  progress.md
```

`feature_list.json` 예:

```json
{
  "id": "CORE-RESONANCE-LINK",
  "priority": "P0",
  "authority": "LOCKED",
  "description": "두 공명침 사이에 공명선을 생성하고 실제 공격 에너지를 포획한다.",
  "status": "NotStarted",
  "evidence": [],
  "blocker": null
}
```

`acceptance_results.json` 예:

```json
{
  "id": "A08",
  "description": "Pulse 방향에 따라 결과가 달라진다.",
  "status": "NotStarted",
  "expected": "A->B와 B->A가 서로 다른 target을 활성화",
  "actual": null,
  "command": null,
  "evidence": []
}
```

`progress.md`:

```text
현재 Stage/Gate:
완료 기능:
AutoVerified:
RuntimeVerified:
VisualVerified:
현재 실패:
Blocked:
다음 우선순위:
변경한 TUNABLE:
재현 명령:
마지막 clean checkpoint:
```

---

# 37. 보스 품질 체크

```text
[ ] 한 문장 핵심 질문
[ ] 공명 시스템을 실제 사용
[ ] 다른 보스와 핵심 공략 다름
[ ] signature가 의미 있음
[ ] anticipation 명확
[ ] 첫 시도 완전 불가시 즉사 없음
[ ] 3~5회 시도 내 단서 축적 가능
[ ] 공략 이해 후에도 실행 숙련 필요
[ ] Seal이 단순 반복 타격 아님
[ ] 실패 이유가 읽힘
[ ] arena reset 완전
[ ] 30/60/144fps 동일
[ ] tuning 없이 처치 가능
[ ] 한국어 표시 정상
[ ] silhouette만으로 다른 보스와 구분 가능
[ ] attack anticipation이 색상 없이도 형태/동작으로 읽힘
[ ] native pixel density와 Art Bible 준수
[ ] sprite/VFX edge에 blur·halo·frame bleeding 없음
```

---

# 38. 명시적 금지

- Titan Souls 리소스/맵/보스 복제
- 플레이어 1HP
- 단일 화살 발사/회수만을 핵심 루프로 사용
- 모든 보스 약점 한 방 즉사
- 단순 HP bar
- DPS sponge
- 잡몹 파밍
- XP/레벨 노가다
- 공격력 성장으로 퍼즐 무시
- RNG 즉사
- 보이지 않는 대형 hitbox
- 긴 runback
- 긴 death menu
- 공략 정답 직접 표시
- UI만 완성하고 전투를 데모로 남기기
- test-only 하드코딩
- dev server에서만 동작
- 실제 browser 검증 없이 완료 선언
- 고해상도 이미지를 축소한 가짜 픽셀아트를 최종 자산으로 사용
- bilinear/soft filtering으로 월드 sprite를 흐리게 렌더
- AI/절차 생성 이미지를 픽셀 단위 수작업 정리 없이 최종 sprite로 투입
- boss 8체를 같은 body sprite의 recolor/부분 수정으로 처리
- placeholder 도형을 `스타일`이라고 주장하고 Release Candidate까지 유지

---

# 39. Core Complete = Yes

다음을 모두 만족한다.

```text
TypeScript strict
2D web engine
high-quality authored pixel-art visual direction
pixel-perfect rendering
Art Bible + representative visual QA
movement/dash
3 resonance needles
link/lattice
signature capture
directional Pulse
Shield/Core survival
Seal boss system
8 bosses
final boss
central hub
4 regions
5-boss final unlock
tunings
Korean UI
save/reload
fast retry
ending
boss replay/time attack
unit/integration
Playwright E2E
production dist
static HTTP(S) validation
```

---

# 40. 완료가 아닌 것

- 프로젝트 생성
- 타이틀 화면
- 이동만 가능
- 공명선 시각효과만 존재
- 실제 collision 없음
- dummy boss 1체
- 모든 보스 같은 패턴
- Shield/Seal이 UI에만 존재
- build PASS만 있음
- E2E 없음
- 엔딩 없음
- save/reload 미검증
- 핵심 sprite/tile/VFX가 placeholder 또는 임시 도형
- 픽셀 렌더는 선명하지만 실제 아트 품질·실루엣·팔레트가 미완성
- B01만 고품질이고 나머지 보스/권역이 저품질 복제 자산
- resize/fullscreen에서 pixel shimmer/blur가 남음

---

# 41. 최종 보고

```text
Core Complete: Yes/No
Production build:
선택 엔진:
TypeScript strict:
AutoVerified:
RuntimeVerified E2E:
VisualVerified:
Pixel Art Quality Gate:
Art Bible compliance:
Placeholder assets remaining:
Blur/Shimmer/FrameBleeding:
한국어 UI:
Needle invariant:
Link/Pulse:
Bosses complete:
Final boss/ending:
Save/reload:
Static deployment:
Performance:
ManualQARequired:
Blocked:
변경한 TUNABLE:
재현 명령:
```

---

# 42. 마지막 명령

**지금부터 실제 구현을 시작하라.**

먼저 작업 경로, 저장소 지침, Git 상태, 기존 코드를 확인한다.

빈 프로젝트면 특별한 이유가 없는 한:

```text
TypeScript strict
Phaser 4
Vite
Vitest
Playwright
```

로 시작한다.

다른 2D 엔진이 더 적합하면 사용할 수 있다.

하지만 다음 핵심은 유지한다.

```text
3개의 공명침
공명선
공격 에너지 포획
방향성 Pulse
Seal 기반 보스
Shield/Core
빠른 재도전
보스 중심
한국어 UI
실제 E2E 완주
```

진행 순서:

```text
Stage 0 Bootstrap
→ Stage 1 Resonance Sandbox
→ Stage 2 First Boss
→ Stage 3 World + 4 Bosses
→ Stage 4 Full Boss Set
→ Stage 5 Final Boss + Ending
→ Stage 6 Release Candidate
```

계획·TODO·보고서만 작성하고 멈추지 마라.

차단되지 않은 필수 기능이나 실패한 Gate가 남아 있으면 구현·실행·수정·검증을 계속한다.

최종 산출물은 **처음부터 엔딩까지 실제 플레이 가능한 한국어 TypeScript 웹 2D 픽셀아트 보스 퍼즐 액션 게임, production `dist/`, 자동 테스트, E2E, 저장/복구, ProjectState, 재현 가능한 실행 명령과 검증 증거**다.

---

# 43. 2026-09-27 적용 변경사항

## 원본 보존 및 우선순위

위 0~42절은 최초 프롬프트 원문으로 보존한다. 원문을 삭제하거나 이 변경사항에 맞춰 덮어쓰지 않는다. 아래 내용은 구현 중 확인된 규칙 혼란을 줄이기 위한 최신 적용 명세다. 0~42절과 충돌하면 이 절을 우선한다. 기술 스택, 픽셀아트 기준, 월드 진행, 저장, 성능 및 나머지 제품 요구사항은 그대로 유지한다.

## 보스전 규칙 단순화

플레이어가 모든 보스에서 익혀야 할 공통 행동을 다음으로 통일한다.

```text
침 2개로 유효한 선 만들기
→ 보스 공격이 선에 닿게 하기
→ 선이 충전되면 E 누르기
→ 다음 봉인 파괴
→ 모든 필수 봉인이 깨지고 코어가 열리면 E 한 번 더 눌러 처치
```

- 보스의 위협 공격이 유효한 공명선과 교차하면 선을 안정적으로 한 번 충전한다. 보스별 `Impact`/`Wave`/`Heat` 같은 signature나 tone을 외우게 하지 않는다.
- 보스전에서 `E`는 충전된 선을 자동으로 사용한다. 플레이어가 선, 끝점, 방향, signature를 따로 선택할 필요가 없다.
- `E` 한 번은 필수 봉인 하나만 진행시킨다. 모든 필수 봉인이 파괴되어 코어가 노출된 뒤의 다음 `E`가 전투를 끝낸다.
- 보스별 공격 모양, 예고, 이동, 애니메이션, 페이즈 연출은 유지할 수 있다. 보스마다 다른 공격 대응 조작을 새로 요구하지 않는다.
- 보스 HUD에는 남은 필수 봉인 수와 다음 행동을 짧게 표시한다.

이 규칙은 보스전에만 적용한다. 일반 퍼즐에서는 조준한 수신기로 에너지를 보내는 방향 선택을 유지한다. 다만 장치의 문은 수신기에 충전 Pulse가 도달하면 열리며 signature/tone 일치를 요구하지 않는다.

## 튜토리얼 진행

튜토리얼은 한 번에 다음 행동 하나만 보여준다.

1. `[좌클릭]` 왼쪽의 빛나는 발판에 첫 공명침을 꽂는다.
2. 다른 침을 문 바로 아래의 빛나는 원형 소켓에 꽂아 선을 만든다. 반대편 먼 발판은 이 튜토리얼의 두 번째 목표가 아니다.
3. Wave가 선에 닿을 때까지 기다린다.
4. 문을 가리키고 `E`를 눌러 연다.

두 침으로 선이 만들어지지 않으면 `R`로 침을 회수하고 첫 안내부터 다시 진행하게 한다. 단계 안내에는 필요한 조작 키와 목적 지점을 함께 적고, `역류`처럼 추가로 설명해야 하는 용어 대신 `반격`을 사용한다.

## 화면 전환

화면 전체를 완전히 검게 덮는 전환 효과를 사용하지 않는다. 전환 오버레이는 어두운 반투명 색으로 제한하고 짧게 표시해 검은 화면이 깜빡이는 인상을 줄인다.

## 원문 조항과의 관계

- 9~10절의 signature/tone 및 방향성 Pulse 규칙은 **보스전 입력 방식에 한해** 위 공통 규칙으로 대체한다. 일반 퍼즐의 방향 지정은 유지한다.
- 17절과 22절의 보스별 Seal/Core 및 페이즈 표현은 유지하되, 봉인 진행과 최종 타격 입력은 위 공통 규칙을 따른다.
- 28절의 튜토리얼은 위 네 단계와 목표 지점을 기준으로 구현한다.
- 그 밖의 원문 규칙은 변경하지 않는다.

## 구현 참조 및 확인 상태

- 주요 구현: `src/resonance/capture.ts`, `src/resonance/pulse.ts`, `src/core/sim/sim.ts`, `src/localization/ko.ts`, `src/world/checkpoints/tutorial.ts`, `src/ui/hud.ts`, `src/ui/styles.css`.
- 2026-09-27 확인: `npm run typecheck`, `npm run build`, `git diff --check` 통과. 브라우저에서 튜토리얼 진입과 첫 발판 입력 후 다음 안내로 넘어가는 흐름을 확인했다.
- 전체 보스전의 수동 플레이 및 자동화 테스트는 이 변경사항 기록 시점에 완료로 간주하지 않는다.
