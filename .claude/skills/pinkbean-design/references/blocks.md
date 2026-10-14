# 있는 부품

새 화면·기능을 만들 때 여기서 고른다. 경로는 따로 적지 않으면 `src/components/shop/` 아래다.

## 틀과 상태

| 무엇 | 어디 | 쓰는 법 |
|---|---|---|
| 모든 상태·핸들러 | `ShopContext.tsx` — `useShop()` | 화면은 여기서 읽고 여기의 함수를 부른다. 알림 `notify(msg)`, 쪽 넘김(`curIdx`·`pageCount`·`setIdx`·`step`·`bindVp`·`bindTrack`), 창 열기(`openSheet`·`openDye`·`openDot`·`closeSurface`), 화면 모드 `bp` |
| 화면 조합 | `../PinkbeanShop.tsx` | 탭마다 어떤 패널을 놓을지 정한다. 새 패널은 여기에 건다 |
| 머리 | `frame/AppHeader.tsx` | 글자가 바뀌어도 폭이 고정되는 `Swap` 이 있다 |
| 아래 바 | `nav/BottomNav.tsx` | 부위 칩 줄 + 탭 바(`TABS`) |
| 탭 ↔ 주소 | `lib/tabRoute.ts` | 탭을 늘리면 `TAB_PATH` 에 넣고 `app/(shop)/<이름>/page.tsx`(빈 페이지)를 만든다. 탭 id `share` 가 코디 광장이다(주소는 `/plaza`. `/share` 는 공유 링크 전용 경로) |
| 화면 모드 | `lib/useBreakpoint.ts` | `bp`, `isStacked`, `isNarrow` |
| 보던 자리 기억 | `lib/uiState.ts` | 세션·기기에 남길 UI 상태 |

## 목록 · 카드 · 쪽 넘김 · 빈 상태

공용 컴포넌트가 아니라 **본뜨는 틀**이다. 새 목록은 아래 둘 가운데 하나를 그대로 따라 만든다(구조와 클래스 묶음을 옮긴다).

| 무엇 | 본보기 |
|---|---|
| 패널 머리 + 쪽 칩 + 검색 입력 + 가로줄 + 뷰포트/트랙/쪽(앞뒤 한 쪽만) + 스켈레톤 격자 + 빈 상태 + 아래 안내 줄 | `list/ListArea.tsx` 의 `ListFrame` + `list/list.module.css` |
| 같은 구조의 두 번째 예(필터 칩, 모바일 가로 스크롤) | `plaza/PlazaPanel.tsx` + `plaza/plaza.module.css` |
| 아이템 카드(즐겨찾기·북마크·염색 버튼) | `list/ItemCard.tsx` — 전역 `pb-cardwrap > pb-card` |
| 코디(스냅샷) 카드(좋아요·수상 배지·지우기) | `plaza/PlazaCard.tsx` |
| 프리셋 카드 격자(이름 바로 고치기) | `preset/PresetPanel.tsx` — 전역 `pb-presetwrap > pb-preset` |
| 빈 상태 | `list.module.css` 의 `.empty` `.emptyTitle` `.emptyHint`(제목 15/600 `#8a8075` + 안내 12.5 `#b7ada2`, 아이콘 없음) |
| 불러오는 중 | 전역 `.pb-skel` 을 실제 칸과 같은 격자로 |

## 창 · 시트

| 무엇 | 어디 |
|---|---|
| 창(PC) / 하단 시트(모바일) | `surface/Surface.tsx` — 종류 `pv` `bm` `dye` `dot` `part` `bg` `vs` `plaza` `ptake` `notice`. 발의 버튼은 `SurfaceFooter({ onApply, applyLabel, onBack })` |
| 막 닫기 | `ui/useMaskClose.ts` — 누름과 뗌이 모두 막일 때만 닫고, 닫은 뒤 따라오는 click 은 버린다 |
| 미리보기 배경 | `lib/stageBg.ts`(`useStageBg`·`setStageBg`·`addStageBg`·`removeStageBg`) + `preview/StageBg.tsx`(미리보기 칸에 까는 것) + `surface/StageBgBody.tsx`(고르는 격자) |
| 펼침·접힘 움직임 | `surface/glide.ts`(`place`·`glideTo`·`release`), `surface/sheetMotion.ts` |
| 창 안에서 옆으로 바꿔 끼우기 | `surface/innerSlide.ts` — `useInnerSlide` |
| 격자에서 하나 고르기(액션·무기 모션·표정) | `preview/PvPicker.tsx` — PC 는 작은 팝오버, 모바일은 시트 안 슬라이드 |

## 알림 · 되묻기

| 무엇 | 어디 |
|---|---|
| 토스트 | `ui/Toast.tsx` — `s.notify('…')` 로 띄운다 |
| 캔버스 우클릭 메뉴와 그 알림 | `lib/canvasMenu.ts` — `bindImageMenu`, `flashToast`(React 밖에서 쓰는 것) |
| 지우기 두 번 누르기 | `lib/confirmTwice.ts`(`confirmTwice`, `CONFIRM_ATTR`) + `ui/ConfirmBubble.tsx` — 누른 버튼 위에 말풍선, 3초 |
| 코디 평가(핑크빈이 무대에 나와 말한다) | `preview/PinkbeanRate.tsx` + `preview.module.css` 의 `.rate` `.bean` `.say` |

## 컨트롤 (`ui/controls.tsx`, `ui/ui.module.css`)

| 무엇 | 이름 |
|---|---|
| 알약·나뉜 탭 | `Seg` — `pc` / `mobileFlex` / `mobileFit` |
| 접어 둔 보기 · 성별 | `list/ListArea.tsx` 의 `FilterM` — '보기 설정' 버튼 + 바로 아래 펼침 칸(모바일 · 좁은 폭) |
| 스위치 | `Switch` |
| 색 고르기 | `FamilyDots`(색상 계열), `Swatch` |
| 숫자 증감 | `Stepper` |
| 슬라이더 + 증감 한 줄 | `DyeRow` — 전역 `.pb-slider` `.pb-track-h/-s/-v` `.pb-dyerow` |
| 고르기(select 대신) | `ui/Dropdown.tsx` — `row` / `rowM` / `field` / `fieldM` |
| 아이콘 | `ui/Icons.tsx`(인라인 SVG 30여 개, `IconTab`) — 새 아이콘도 여기에 같은 굵기로. 염색은 팔레트(`IconDrop` 과 탭 아이콘 `info` — 이름은 예전 그대로), 더하기는 `IconAdd` |

## 전역 클래스 (`app/globals.css`)

- 버튼: `pb-solid`(채움) · `pb-ghost`(외곽선) · `pb-soft`(옅음) · `pb-icon` · `pb-cardact` · `pb-arrow` · `pb-step`
- hover 만 얹는 것: `pb-input` · `pb-slotrow` · `pb-partchip` · `pb-pageinput` · `pb-presetname` · `pb-accbar` · `pb-ddbtn` · `pb-ddrow`
- 카드: `pb-cardwrap > pb-card`(+ `pb-card-sel`) · `pb-presetwrap > pb-preset`(+ `pb-preset-sel`)
- hover 로 드러나는 것(터치에서는 늘 보임): `pb-slot` / `pb-slot-x` · `pb-presetacts` · `pb-ribbon`
- 스크롤바: `pb-scroll` · `pb-scroll-thin` · `pb-norail`
- 가장자리 흐림: `pb-fade`(스크롤 칸에 단다 — `ui/useScrollFade.ts` 가 남은 쪽을 `data-fade` 로 적는다) · `pb-fadepop`(그림자 있는 떠 있는 목록에 함께)
- 움직임: `pb-drawer` · `pb-slide`
- 그 밖: `pb-skel` · `sr-only` · 속성 `[data-pb-panel]` `[data-pb-body]`, `html[data-pb-bgonly]`(배경 보기)

## 캐릭터·아이템 그리기

직접 캔버스에 합성하지 않는다. 아래 가운데 하나를 쓴다(규칙이 한 곳에 있어야 미리보기와 카드가 같은 그림이 된다).

| 무엇 | 어디 |
|---|---|
| 지금 코디의 미리보기 | `PreviewModel.tsx` |
| 저장된 코디(스냅샷) 한 장 | `SnapThumb.tsx` — 프리셋·광장·VS·가져오기가 함께 쓴다 |
| 아이템 카드의 그림(아이템 / 기본 캐릭터 / 내 캐릭터) | `ItemThumb.tsx` |
| 염색 화면의 그림 | `render/DyeSprite.tsx`, `render/DyeModelPreview.tsx`, `render/DyeCellCanvas.tsx` |
| 슬롯 줄의 작은 그림 | `info/SlotSprite.tsx` |
| 그리는 순서 대기열 | `lib/thumbQueue.ts` — `enqueueThumb` |
| 복사·저장 이미지 | `lib/canvasExport.ts` — `modelShotBlob`·`copyImage`·`saveImage` |
| 합성·염색·가림의 코어 | `lib/core/`(README 가 있다) |

## 광장에서 가져다 쓸 수 있는 것

`plaza/PlazaComments.tsx`(댓글 + 입력), `plaza/PlazaRefViewer.tsx`(그림 확대·이동, 보일 자리 고르기), `plaza/NoticeBody.tsx`(서피스 안의 쪽 목록 + 댓글), `plaza/PlazaTakeBody.tsx`(프리셋 칸 고르기).

## 배경

`scene/SceneCanvas.tsx`(`kind: 'sky' | 'room'`), `frame/Background.tsx`. `scene/sceneData.ts` 는 parser 의 `scene-build.cjs` 가 만든 파일이라 손으로 고치지 않는다.

## 이 규칙 밖에 있는 페이지

`app/guide/*`(검색용 안내 페이지, 인라인 스타일), `app/suggestion/*`(운영자용), `app/viewer/*`(개발 도구). 앱 화면의 본보기로 삼지 않는다.
