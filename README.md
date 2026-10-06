# 핑크빈 커마샵 — Front

메이플스토리 캐릭터 **코디(외형) 세팅 서비스**의 프론트엔드.
부위별 아이템 착용 · 염색 · 캐릭터 미리보기 연출 · 프리셋 저장/공유 · AI 코디 검색 · 코디 광장.

- **스택**: Next.js 14(App Router) · React 18 · TypeScript
- **배포**: Vercel — `main` → `pinkbean-customize.com`, `dev` → `dev.pinkbean-customize.com`

## 데이터
- 아이템(스프라이트·메타·목록)은 CDN `https://cdn.pinkbean-customize.com` 에서 정적으로 받아, 브라우저 캔버스에서 합성·염색한다(`src/lib/core`).
- 프리셋은 브라우저 `localStorage` 에만 있다.
- 공유 링크의 코드는 R2, 코디 광장은 Supabase, AI 코디 검색·코디 평가는 별도 백엔드(`pinkbean-customize-shop-back`)를 쓴다.
- 닉네임으로 코디 불러오기는 넥슨 Open API(`NEXON_API_KEY`, 서버 전용).

## 개발
```bash
npm install
npm run dev                          # http://localhost (포트 80)
npx tsc --noEmit --noUnusedLocals    # 타입 검사
npm run build                        # 프로덕션 빌드
```

환경변수(`.env.local`): `NEXON_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, (공유 코드 저장용) `R2_ENDPOINT`·`R2_ACCESS_KEY_ID`·`R2_SECRET_ACCESS_KEY`.
`NEXT_PUBLIC_*` 는 빌드 시점에 박히므로 바꾸면 다시 배포해야 한다.

브랜치·병합 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md), 세션 작업 가이드는 [CLAUDE.md](CLAUDE.md).
