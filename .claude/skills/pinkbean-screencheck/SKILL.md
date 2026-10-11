---
name: pinkbean-screencheck
description: 핑크빈 커마샵 화면을 PC 1440 · 절반 860 · 태블릿 1000(터치) · 모바일 390 폭으로 실제 브라우저에 띄워 확인할 때 쓴다. playwright 로 네 폭을 캡처하고 배치 체크리스트를 돌린다. 화면을 고친 뒤 "확인해봐"·"어떻게 보이는지 봐"·폭별 확인·모바일 확인 요청에 사용.
---

# 폭별 화면 확인

## 어디를 볼 것인가

1. **dev 사이트 `https://dev.pinkbean-customize.com`** — 기본. 고친 것을 `dev` 에 올리고 배포가 끝난 뒤 본다.
   왜: CDN 은 `http://localhost`(포트 80)·dev·운영 출처만 허용한다. 다른 곳에서 띄우면 아이템이 안 뜨고, 그 상태로 "확인했다"고 한 적이 있다.
2. **로컬** — 아직 올리지 않은 변경을 꼭 봐야 할 때만. 아래 규칙을 지킨다.
   - **포트 80(`npm run dev`)은 사용자 전용이다.** 백그라운드로도 띄우지 않는다.
   - 사용자의 서버와 `.next` 가 부딪치지 않게 **복사본**에서 3100 으로 띄운다:
     ```
     robocopy <front 폴더> "%TEMP%\pb-check" /MIR /XD node_modules .next .git
     mklink /J "%TEMP%\pb-check\node_modules" <front 폴더>\node_modules
     cd /d %TEMP%\pb-check && npx next dev --port 3100
     ```
   - 3100 은 CDN 이 허용하지 않는 출처다. `shots.mjs` 는 CDN 응답에 허용 헤더를 끼워 넣어 실제 데이터로 보이게 한다. playwright MCP 로 직접 볼 때는 같은 일을 한다:
     ```js
     await page.route('https://cdn.pinkbean-customize.com/**', async (route) => {
       const r = await route.fetch()
       await route.fulfill({ response: r, headers: { ...r.headers(), 'access-control-allow-origin': '*' } })
     })
     ```
   - **확인이 끝나면 띄운 서버를 반드시 끈다**(자식 node 프로세스까지).
3. 운영 사이트는 읽기만 한다. 시험 글·좋아요·댓글을 만들지 않는다.

## 캡처

처음 한 번 설치한다(크로미움을 내려받는다 — 수백 MB):

```
cd .claude/skills/pinkbean-screencheck && npm ci && npx playwright install chromium
```

`scripts/shots.mjs` 가 네 폭을 한 번에 찍는다(태블릿·모바일은 터치 에뮬레이션 포함). front 폴더에서:

```
node .claude/skills/pinkbean-screencheck/scripts/shots.mjs https://dev.pinkbean-customize.com
node .claude/skills/pinkbean-screencheck/scripts/shots.mjs https://dev.pinkbean-customize.com --tab=plaza
node .claude/skills/pinkbean-screencheck/scripts/shots.mjs http://localhost:3100 --only=tablet --click="액션"
```

- `--tab` 은 `plaza`·`ai`·`look`·`notice` 또는 탭에 적힌 글자, `--click` 은 찍기 전에 누를 버튼(aria-label 또는 글자) — 팝오버·시트를 **연 모습**을 찍을 때.
- `--out=<폴더>` 로 저장할 곳을 정한다(없으면 임시 폴더의 `pb-shots`). 결과는 `pc.png`·`half.png`·`tablet.png`·`mobile.png`. **찍은 뒤 Read 로 직접 본다.**

## 무엇으로 볼 것인가

| 하려는 것 | 쓸 것 |
|---|---|
| 폭별로 어긋난 데 없나 훑기 | **이 스크립트**(네 폭 한 번에) |
| **태블릿(터치)** | **이 스크립트만.** 폭만 줄이면 태블릿이 아니라 절반 모드가 나온다(터치여야 태블릿이다) |
| 눌러 보며 동작 확인(창 열기·값 적용·되돌아오기) | playwright MCP |
| **수치 재기**(요소 좌표·남는 폭·전환 도중의 값·캔버스 픽셀) | playwright MCP — `getBoundingClientRect`·`getComputedStyle` 을 직접 읽는다 |
| 어느 CSS 파일·클래스에서 온 값인지 | `/viewer`(아래) |

보고에 쓸 숫자는 재서 적고, "다른 폭에서 안 깨졌나"는 스크립트로 확인한다. 한쪽만 쓰면 태블릿이나 실측 가운데 하나가 빠진다.

- 스쳐 지나가는 프레임을 잡으려면 playwright `route` 로 `_next/static/chunks` 를 늦춘다.
- 페이지의 JS 로는 마우스를 터치로 바꿀 수 없다. 터치 동작은 playwright 의 `hasTouch` 나 크롬의 기기 모드로 본다.

## 화면 뷰어 `/viewer`

앱 안의 개발용 뷰어다(dev 사이트와 로컬에만 있다. 운영에서는 404). 왼쪽에 앱을 폭별로 띄우고, **요소를 누르면 그 요소의 CSS 모듈 파일·클래스와 계산된 값**(크기·padding·display·글자·색·transition)이 나온다. 값을 정확히 집어야 할 때 캡처보다 빠르다.

- 태블릿 프레임은 `?pbtouch=1` 로 터치 모드를 강제한다(iframe 은 `pointer:coarse` 를 만들 수 없다).
- 사용자가 "이 요소 이렇게 바꿔줘"라며 붙여 넣는 블록은 이 뷰어의 **복사** 버튼 출력이다. 첫 줄이 `파일 › .클래스` 이므로 그 파일을 열면 된다.

## 화면 모드 (틀리면 엉뚱한 화면을 본다)

`lib/useBreakpoint.ts` 의 `bpOf(폭, 터치)`

| 모드 | 조건 | 확인 폭 |
|---|---|---|
| mobile | ≤ 520 | **390×844**, 터치 |
| half | 521~1199, 마우스 | **860×900** |
| tablet | 861~1199, **터치** | **1000×1280**, 터치 |
| pc | ≥ 1200 | **1440×900** |

## 체크리스트

**모든 폭**
- [ ] 의도하지 않은 가로 스크롤이 없다.
- [ ] 좌우 여백이 머리·가로줄·카드 격자에서 같다. 탭이 달라도 패널 머리의 컨트롤 높이와 카드 규격이 같다.
- [ ] 잘린 글자, 말줄임 없이 넘치는 글자, 겹친 요소가 없다.
- [ ] 글자나 상태가 바뀔 때 옆 요소가 밀리지 않는다.
- [ ] 빈 상태·스켈레톤이 실제 내용과 같은 자리·크기다.

**모바일 390**
- [ ] 아래 부위 바·탭 바가 내용을 가리지 않는다.
- [ ] 시트 본문이 스크롤된다(자식이 찌그러지지 않는다).
- [ ] 입력에 초점을 줘도 화면이 확대되지 않는다.
- [ ] 목록은 좌우로 넘기고 쪽 번호가 맞물린다. 목록 안에 세로 스크롤이 없다.
- [ ] 카드가 납작하지 않다(세로로 긴 비율을 지킨다).

**절반 860 / 태블릿 1000**
- [ ] 2분할이 유지되고 오른쪽 열의 폭이 312(절반)·330(태블릿)이다.
- [ ] 태블릿에서 hover 로만 보이던 것(카드 위 버튼)이 늘 보인다.
- [ ] 머리가 두 줄로 접히고 컨트롤이 겹치지 않는다.

**PC 1440**
- [ ] 페이지 전체 스크롤이 없다(패널 안에서만 스크롤).
- [ ] 격자가 의도한 열·행이다(코디 6×3, 광장 6열).

## 보고

캡처를 직접 본 뒤 **무엇이 어긋났는지 폭과 함께** 적는다("모바일 390 에서 등록 버튼이 탭 바에 8px 가려짐"). 화면을 못 봤으면 봤다고 하지 않는다. 앞선 확인이 틀렸으면 틀렸다고 분명히 적는다.
