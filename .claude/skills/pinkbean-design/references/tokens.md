# 색 · 글자 · 형태 · 상태 · 모션

지금 CSS(`src/app/globals.css`, `src/components/shop/**/*.module.css`)에서 옮긴 값이다. 표에 없는 값이 필요하면 같은 역할의 기존 요소에서 찾는다.

## 색

| 역할 | 값 |
|---|---|
| 페이지 바탕(배경 장면이 뜨기 전) | `linear-gradient(165deg,#fdf2f8,#f6ecf6 55%,#efe8f7)` |
| 패널·카드 바탕 | `#fff` |
| 테두리 | 패널 `#e7ded4` · 카드 `#eee6dc` · 얇은 구분 `#f0e9e1` · 패널 안 가로줄(`.hr`) `#f2ebe3` |
| 입력·칩 바탕 | `#faf7f3` · 썸네일 바탕 `#f7f2ec` · 옅은 면 `#f4efe8` `#fbf8f4` |
| 글자 | 본문 `#2a2521` · 입력과 이름 `#3d372f` · 보조 `#5c534b` `#8a8075` · 흐림 `#a89e93` `#b7ada2`(placeholder) `#c3b9ad` |
| **핑크(주색)** | `#ec86ac` |
| 핑크 진하게 | 채운 버튼 hover `#d5578e` · 글자 `#d76d9a` `#c85d8a` `#c05a94` |
| 핑크 면 | `#fce9f1` `#fdf4f8` `#fdf0f5`(선택 바탕) `#fbe0ec` `#f6dbe8` `#f7ecf1` |
| 핑크 테두리 | `#f4cfdf`(포커스 링) `#eeb2ce`(입력 hover) `#f0d3e0` |
| 보라 | `#b57bdb` — 토스트·로고 그라데이션에만 |
| 지우기·위험 | `#e0533e` · 연하게(되묻는 말풍선, 지우기 글자) `#d1735f` |
| 창 뒤의 막 | `rgba(42,37,33,0.40)` |
| 스크롤바 | `#e7c3d4`(굵게) · `#eecfdd`(가늘게) |

## 글자

- Wanted Sans Variable(`src/assets/fonts` 의 파일 — `font-family: var(--font-wanted), "Wanted Sans Rest"`. `app/layout.tsx`), `letter-spacing:-0.01em`, `word-break: keep-all`.
- 굵기: 본문·라벨 500 · 강조 600 · 제목과 고른 값 700.
- 크기는 반 픽셀 단계를 쓴다. 자주 쓰는 것: 15(빈 상태 제목·큰 제목) · 13(입력·본문) · 12~12.5(라벨·안내) · 11~11.5(보조·모바일 버튼) · 10.5(배지). 로고는 PC 16 · 모바일 15.
- 바뀌는 숫자(쪽 번호·개수·염색 수치)는 `font-variant-numeric: tabular-nums`.
- **모바일 입력의 글자도 13px 이다.** 확대는 글자 크기가 아니라 viewport(`maximumScale: 1, userScalable: false`)와 `app/NoNativeZoom.tsx` 로 막는다. 입력을 16px 로 키우지 않는다.

## 형태

| 무엇 | 값 |
|---|---|
| 패널(목록·정보·프리셋·광장·서피스) | radius **10**, 테두리 1px `#e7ded4`, `overflow:hidden`, flex column |
| 모바일 시트 | radius `12px 12px 0 0` |
| 아이템 카드 | radius **8**, 안쪽 `8px 8px 6px`(모바일 `7px 8px 5px`), 테두리 1px `#eee6dc` |
| 프리셋·광장 카드 | radius 8(안에 붙는 썸네일은 위쪽만 7), 테두리 1.5px `#eee6dc` |
| 버튼·입력·칩 | radius 6. 작은 컨트롤과 칸 안에 든 버튼은 4. 알약(20·99·999)과 원은 그대로 |
| 스켈레톤 칸 | radius 8 |

- **둥글기는 10 · 8 · 6 · 4 네 단계뿐이다**(모바일 시트와 큰 창만 12). 겉이 둥글수록 안은 한 단계 작게 — 안쪽 둥글기 = 바깥 둥글기 − 사이 간격이라는 겹친 모서리 규칙을 따른다(패널 10 안의 컨트롤 6, 컨트롤 6 안의 버튼 4). 왜: 14·12·9·8·7·6 이 섞여 있던 때는 뭉툭해 보였고, 5 와 2.5 로 줄여 보니 딱딱했다(사용자). 새 값을 만들지 않는다.

- **간격**은 4·6·8·10·12·16 이 기본이고(20·24 는 큰 여백), 촘촘한 자리에 3·5·7·9·11·14 도 쓰인다. 새 숫자를 고르지 말고 **같은 역할의 요소가 쓰는 값**을 가져온다. 패널 안 좌우는 PC 16 · 모바일 12, 목록의 칸 사이는 10.
- 나란한 요소는 flex·grid 와 `gap` 으로 띄운다.
- **그림자는 이것뿐이다**: 팝오버·되묻는 말풍선 `0 12px 32px rgba(42,37,33,.12)` · 드롭다운 `0 10px 26px rgba(42,37,33,.14)` · 토스트 `0 10px 28px rgba(180,123,219,.36)` · 떠 있는 작은 버튼 `0 1px 4px rgba(42,37,33,.12)` · 코디 평가 말풍선 `0 5px 16px rgba(200,90,150,.22)`. 서피스(창) 자체에는 그림자가 없다.

## 부품의 치수

| 부품 | 치수 |
|---|---|
| 패널 머리(PC) | `padding: 10px 16px 0`, 안의 컨트롤 높이 **34**, 아래에 가로줄(`.hr`, `margin: 10px 16px 0`). 패널 제목 글자는 없다 |
| 패널 머리(모바일) | `padding: 8px 12px`, 컨트롤 높이 32, 줄 사이 8 |
| 쪽 칩 | 높이 34(모바일 32), 테두리 `#f0e9e1`, 바탕 `#faf7f3`, 화살표 22×24, 쪽 입력 높이 22 |
| 검색 입력 | 높이 34(모바일 32), 왼쪽에 아이콘 자리 30, 13px |
| 프리셋 불러오기 | 높이 34(모바일 32) — 머리의 다른 칸과 같다. 아이콘 + 입력 + 채운 버튼(높이 26, radius 4)을 한 테두리 안에 묶고, 면 `#fdf4f8` · 테두리 `#f4cfdf`(포커스 `#ec86ac` + 흰 면). PC 는 머리의 남는 폭을 480 까지 차지한다 |
| 아래 안내 줄 | 높이 30, 11.5px, 낮은 화면에서는 24·22 로 줄어든다(`globals.css`) |
| 서피스 머리 / 발 | `8px 12px` / `10px 16px`, 닫기 버튼 32(모바일 34) |
| 버튼 높이 | 큰 것 38~40(서피스 적용, 광장 등록) · 보통 34(머리의 도구, 불러오기) · 작은 것 32 · 모바일 머리 버튼 28 |
| 토스트 | 아래 가운데 26px 위, radius 8, 12.5px, `max-width: min(275px, 75vw)`(모바일 `width: 75vw`), 2.2초, z-index 10000 |
| 되묻는 말풍선 | 누른 버튼 위 8px, 흰 바탕 + 테두리 `#e7ded4`, radius 6, `8px 12px`, 12/600 `#d1735f`, 꼬리 8px, 아래에 남은 시간 막대(높이 3, 3초) |
| 스크롤바 | `.pb-scroll` 9px · `.pb-scroll-thin` 8px · `.pb-norail` 숨김 |

## hover (전부 `(hover:hover) and (pointer:fine)` 안)

| 대상(클래스) | 효과 |
|---|---|
| 채운 버튼 `pb-solid` | 바탕 `#ec86ac → #d5578e` |
| 외곽선 버튼 `pb-ghost` | 바탕 `#fbe0ec` + 테두리 `#ec86ac` + 글자 `#c05a94` |
| 옅은 버튼·고르지 않은 칸 `pb-soft` | 바탕 `#f6dbe8` + 글자 `#c85d8a` |
| 아이콘 버튼 `pb-icon` · 증감 `pb-step` | 바탕 `#f7ecf1` + 글자 핑크 |
| 카드 위 작은 버튼 `pb-cardact` · 쪽 화살표 `pb-arrow` | 바탕 `#fce9f1` + 글자 `#d76d9a` |
| **카드** `pb-cardwrap > pb-card`, `pb-presetwrap > pb-preset` | 테두리 핑크 + `translateY(-4px)`. 바깥 래퍼가 hover 를 받고 안쪽만 움직인다(판정이 흔들리지 않게) |
| 입력 `pb-input` · 드롭다운 `pb-ddbtn` | 테두리 `#eeb2ce` |
| 드롭다운 줄 `pb-ddrow` | 바탕 `#fdf1f6` + 글자 `#c85d8a` |
| 슬롯 줄 `pb-slotrow` · 부위 칩 `pb-partchip` | 바탕 옅은 핑크 + 테두리 `#eeb2ce` |
| 프리셋의 띠지·작은 동작 `pb-ribbon`·`pb-presetacts` | 살짝 어둡게 + 1px 내려앉음 |

인라인 `style` 로 준 색 위에 hover 를 입히려고 위 규칙들은 `!important` 를 쓴다. CSS 가 나중에 덮어야 하는 값은 인라인이 아니라 스타일시트에 둔다(인라인이 늘 이긴다).

## 그 밖의 상태

- focus: 입력은 테두리 `#ec86ac`, 버튼은 `outline: 2px solid #f4cfdf; outline-offset: 2px`.
- 선택: 테두리 `#ec86ac` + 바탕 `#fdf0f5` + (카드면) `translateY(-5px)`. hover 규칙 뒤에 둔다(선택이 이긴다).
- 못 누름: `opacity .4` + `cursor: not-allowed` + 왜 못 누르는지 `title`.
- 불러오는 중: `.pb-skel` 셔머를 실제 내용과 같은 자리·크기로. 처음 불러올 때만 깐다.

## 모션

| 무엇 | 값 |
|---|---|
| 버튼·입력의 색·테두리·바탕 | `.22~.24s ease`(전역 `button, input, select` 규칙) |
| 카드 이동 | `transform .18s ease` |
| 서피스·서랍·시트(열림·닫힘 같은 곡선) | `.26~.3s cubic-bezier(.45,0,.55,1)`, 불투명도 `.22s`, 뒤의 막 `.24s`. 모바일 시트는 300ms(`surface/sheetMotion.ts`) |
| 목록의 쪽 넘김 | `.34s cubic-bezier(.22,.61,.36,1)` |
| 창을 떼어 내는 시점 | 닫힘 전환이 끝난 뒤(320ms — `ui/useDialogFade.ts`) |
| 토스트 | `.28s` |

- 나타나는 전환이 보이도록, 붙인 뒤 **한 프레임 뒤에** 위치를 바꾼다.
- 등장만을 위한 `@keyframes` 보다, 늘 붙여 두고 `opacity`·`transform`·`pointer-events` 를 바꾸는 쪽을 쓴다.
- `prefers-reduced-motion` 을 따른다(`globals.css`).
