# 공명선: 봉인된 심장

TypeScript와 Phaser로 만든 한국어 2D 픽셀아트 보스 퍼즐 액션 게임입니다.

**플레이:** https://legerdo.github.io/resonant-lines/

## 조작

- `WASD` 또는 방향키: 이동
- 마우스: 조준
- 좌클릭: 공명침 발사
- `Q` 또는 휠: 공명침 선택
- 우클릭: 선택한 침 회수
- `R`: 모든 침 회수
- `E`: 충전된 공명선 방출
- `Shift` 또는 `Space`: 회피
- `Esc`: 일시정지

보스전에서는 공격이 공명선을 지나가 충전되면 `E`를 눌러 다음 봉인을 깨뜨립니다. 필수 봉인이 모두 깨져 코어가 열리면 `E`를 한 번 더 눌러 승리합니다.

## 로컬 실행

Node.js 22.12 이상이 필요합니다.

```bash
npm ci
npm run dev
```

프로덕션 빌드는 다음 명령으로 만듭니다.

```bash
npm run build
```

`main`에 변경사항을 푸시하면 GitHub Actions가 `dist/`를 빌드해 GitHub Pages에 배포합니다.
