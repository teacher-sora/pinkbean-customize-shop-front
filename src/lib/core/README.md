# `src/lib/core` — 캐릭터 합성 · 염색 코어

화면에 보이는 모든 캐릭터·아이템 그림이 이 폴더를 거친다(미리보기, 카드, 광장, 공유 카드, 복사 이미지).

## 파일
- `data.ts` — 데이터 접근 계층. 모든 리소스를 CDN(`https://cdn.pinkbean-customize.com`)에서 받는다. 타입(`ItemMeta`·`Index`·`Layer`·`Frame`)의 단일 출처. 자리 코드(islot·vslot)가 잘못 들어간 아이템을 여기서 보정한다.
- `assemble.ts` — 캐릭터 조립. 몸통 `navel` 을 원점으로 부위별 앵커를 이어 붙여, 어떤 액션·프레임에서도 캐릭터가 같은 자리에 선다. zmap 순으로 그린다. 뒷모습 프레임 판정(`isBackFrame`)도 여기.
- `occlusion.ts` — smap·vslot 기반 가림(모자 ↔ 헤어 등).
- `dye.ts` — 염색. 헤어·성형은 팔레트 혼합(색 A·B·비율), 그 밖의 캐시 아이템은 HSB(게임 클라이언트 `Prism.cs` 를 그대로 옮긴 것 — 추측으로 고치지 않는다).
- `render.ts` — 조립 결과를 캔버스에 그리기, 이펙트.
- `modelPlacement.ts` — 칸에 맞춘 정수 배율과 캔버스 크기(`computeModelPlacement`·`canvasBitmap`·`fitCanvas`).
- `snapRender.ts` — 스냅샷(저장된 코디) 한 장을 합성한다. 프리셋·광장·상세·공유 카드가 함께 쓰고, 결과를 캐시한다.
- `thumbEffects.ts` · `warm.ts` · `slots.ts` · `lru.ts` — 썸네일 이펙트, 미리 받기, 부위 표, 캐시.

## 지킬 것
- 캔버스는 **정수 배율만**(소수 배율은 도트를 뭉갠다). 크기·정렬은 `modelPlacement` 의 함수를 쓴다.
- 미리보기(`PreviewModel`)와 스냅샷 합성(`snapRender`)의 규칙이 달라지면 안 된다 — 한쪽만 고치면 카드와 미리보기가 다른 그림이 된다.
- 라이딩 규칙은 `lib/shopData.ts` 한 곳에 있다.
