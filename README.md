# 핑크빈 커마샵 — Front

메이플스토리 스타일 **코디(외형) 세팅 서비스**의 프론트엔드. 부위별 아이템 착용 · 염색 ·
캐릭터 미리보기 연출 · 프리셋 저장/공유를 제공하는 스크롤 없는 단일 페이지 반응형 웹.

- **스택**: Next.js 14 (App Router) · React 18 · TypeScript
- **배포**: Vercel (이 저장소의 `main` 브랜치)

## 현재 단계 — 디자인 핸드오프 재현
`design_handoff_pinkbean_shop`의 디자인/인터랙션을 충실히 이식한 상태다. 아이템·캐릭터는
전부 **플레이스홀더**(mock 60종, CSS 썸네일, 점선 미리보기)이며, 룩앤필/인터랙션 검증이 목적.

## 다음 단계 — CDN 연동 & 실제 합성
- 데이터: Cloudflare **R2 CDN**(`https://cdn.pinkbean-customize.com`)에서 index/slots/meta 로드
- 렌더: `src/lib/core`(assemble/dye/render)로 실제 스프라이트 합성 + 정밀 염색
- 임포트: 넥슨 OpenAPI(닉네임) / Supabase(공유코드)
> `src/lib/core`는 프로토타입에서 검증된 **핵심 렌더링 파이프라인**(레거시 아님). 자세한 내용은
> `src/lib/core/README.md` 참고.

## 개발
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드 검증
```

## 구조
```
src/
  app/            # Next App Router (layout, page, globals.css)
  components/
    PinkbeanShop.tsx   # 메인 화면 (디자인 핸드오프 재현)
  lib/core/       # 캐릭터 합성·염색 코어 (CDN 단계에서 연결)
```
