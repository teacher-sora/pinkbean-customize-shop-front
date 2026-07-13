# `src/lib/core` — 캐릭터 합성 · 염색 코어 (⚠️ 레거시 아님)

메이플 프로토타입(`maple test/web/lib`)에서 **검증 완료된 핵심 렌더링 파이프라인**을 그대로 가져온 것.
이건 서비스 완성 후에도 유지되는 **핵심 기술**이며 제거 대상(레거시)이 아니다.

## 파일
- `data.ts` — 데이터 접근 계층. 모든 리소스를 `DATA_BASE`(기본 = R2 CDN `https://cdn.pinkbean-customize.com`)에서 fetch. 타입(`ItemMeta`/`Index`/`Layer`/`Frame` 등)의 단일 출처.
- `assemble.ts` — **순수 캐릭터 조립**. body `navel`을 월드 원점(0,0)으로 삼아 부위별 앵커(map 포인트)로 정렬 → **어떤 액션/프레임에서도 캐릭터가 중앙에 고정**되는 로직. zmap 순서로 페인트.
- `dye.ts` — **정밀 염색**. 팔레트 혼합(hair/성형: 두 색상 변형 스프라이트 픽셀 보간) + HSB(캐시 아이템: WcR2 `Prism.cs` 충실 포팅, 색상계열 게이트/16비트 스텝/238 캡).
- `occlusion.ts` — smap/vslot 기반 부위 가림(모자↔헤어 등).
- `render.ts` — 조립 결과를 캔버스에 그리기 + 이펙트/스프라이트 URL.
- `lru.ts` — 염색/렌더 결과 캐시.

## 현재 상태 (디자인 재현 단계)
아직 UI(`components/PinkbeanShop.tsx`)에 **연결되어 있지 않다.** 지금 화면은 디자인 핸드오프
재현이 목적이라 플레이스홀더(mock 아이템·점선 미리보기·hsl 근사 염색)를 쓴다.

## CDN 연동 단계에서 할 일
1. `NEXT_PUBLIC_DATA_BASE`를 CDN URL로 설정(기본값이 이미 CDN이라 미설정이면 CDN 사용).
2. 미리보기 점선 카드를 `assemble.getFrameLayers` + `render` 캔버스로 교체.
3. 염색 미리보기(hsl/rgb 근사)를 `dye.buildOverrides`(팔레트/HSB)로 교체.
4. 필요 시 `tsconfig.json`의 `exclude`에서 이 폴더를 풀고 strict 타입 정리.
