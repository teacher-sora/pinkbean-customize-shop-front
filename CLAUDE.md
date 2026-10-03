# 핑크빈 커마샵 Front — 작업 가이드 (모든 세션 공통)

메이플스토리 캐릭터 코디 웹앱의 프론트엔드. Next.js 14(App Router) · React 18 · TypeScript.
`main` → 운영(`pinkbean-customize.com`), `dev` → dev 사이트(`dev.pinkbean-customize.com`). 둘 다 Vercel.

전체 구조와 규칙의 정본은 **`Desktop/maple test/ARCHITECTURE.md`** 다(§5 프론트, §6 코디 광장). 여기에는 이 레포에서 바로 필요한 것만 적는다.

## 구조
```
src/
  app/              page(홈) · share(공유 링크 메타) · guide · viewer(dev 전용)
                    api/nick · api/share · api/plaza/…
  components/
    PinkbeanShop.tsx        조합 루트(ShopProvider + Shell)
    shop/ShopContext.tsx    모든 상태·핸들러의 단일 출처(useShop())
    shop/frame nav list info preset preview surface plaza ui render
    shop/PreviewModel.tsx · ItemThumb.tsx · SnapThumb.tsx · LookDialog.tsx
  lib/
    core/           캐릭터 합성·염색·가림·렌더 코어(core/README.md)
    shopData.ts     부위·라이딩 규칙      catalog.ts   정적 데이터·공유 타입
    plaza*.ts       코디 광장            shareCode.ts · shareImage.ts   공유 링크
    uiState.ts      보던 자리 기억        canvasExport.ts   복사·저장 이미지
supabase/           코디 광장 스키마 SQL(번호순, public 과 plaza_dev 를 함께 담는다)
scripts/merge-dev-to-main.sh
```
상태는 `ShopContext`, 아이템 데이터는 CDN(`https://cdn.pinkbean-customize.com`)에서 받는다.

## 스타일
- 정적 스타일은 컴포넌트 옆 `*.module.css`. 인라인은 즉시 수치를 반영해야 하는 값만.
- 여러 컴포넌트가 함께 쓰는 것(카드 hover, 다이얼로그 전환, 스크롤바 등)은 `app/globals.css` 에 있다 — 재사용한다.
- 디자인은 확정돼 있다. 색·간격·모션 값은 `maple test/.claude/skills/pinkbean-design` 에서 고른다.

## 명령
```bash
npm install
npm run dev                          # http://localhost (포트 80) — 사용자 전용
npx tsc --noEmit --noUnusedLocals    # 커밋 전 통과 확인(테스트·린트는 없다)
```

## 브랜치와 병합
- `main` 에 직접 커밋하지 않는다. `dev` 에 올려 dev 사이트에서 확인하고, 지시가 있을 때 운영으로 올린다.
- dev → main 은 **`sh scripts/merge-dev-to-main.sh`** 로만 병합한다(`src/app/viewer` 를 빼고 커밋한다). 그 뒤 `git push origin main`.
- `src/app/viewer` 는 dev 전용이다. 훅(`.githooks`)·워크플로(`guard-dev-only.yml`)·병합 스크립트를 지우거나 우회하지 않는다.
- git 신원은 이 저장소 로컬 config 의 `teacher-sora <sora05153@gmail.com>`.
