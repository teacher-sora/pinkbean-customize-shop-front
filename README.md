# pinkbean-customize-shop-front

메이플스토리 캐릭터 **코디(외형) 세팅 서비스** "핑크빈 커마샵"의 프론트엔드.
부위별 아이템 착용 · 염색 · 캐릭터 미리보기 연출 · 프리셋 저장/공유 · AI 코디 검색 · 코디 광장.

- **스택**: Next.js 14(App Router) · React 18 · TypeScript
- **배포**: Vercel — `main` → <https://pinkbean-customize.com>, `dev` → <https://dev.pinkbean-customize.com>

| 문서 | 내용 |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 구조와 규칙, 운영 환경(Vercel·Supabase·R2·넥슨 API·환경변수) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 브랜치와 병합 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 세션 지침 |
| [.claude/skills/](.claude/skills/) | 디자인 규칙(`pinkbean-design`) · 폭별 화면 확인(`pinkbean-screencheck`) |
| [src/lib/core/README.md](src/lib/core/README.md) | 캐릭터 합성·염색 코어 |

## 데이터

- 아이템(스프라이트·메타·목록)은 CDN `https://cdn.pinkbean-customize.com` 에서 정적으로 받아 브라우저 캔버스에서 합성·염색한다. 데이터를 뽑아 올리는 것은 [parser 레포](https://github.com/teacher-sora/pinkbean-customize-shop-parser)다.
- 프리셋은 브라우저 `localStorage` 에만 있다.
- 공유 링크의 코드는 R2, 코디 광장은 Supabase, AI 코디 검색·코디 평가는 [back 레포](https://github.com/teacher-sora/pinkbean-customize-shop-back)의 서버를 쓴다.
- 닉네임으로 코디 불러오기는 넥슨 Open API.

## 개발

```bash
npm install
git config core.hooksPath .githooks  # 한 번(CONTRIBUTING.md)
npm run dev                          # http://localhost (포트 80)
npx tsc --noEmit --noUnusedLocals    # 타입 검사(테스트·린트는 없다)
npm run build
```

환경변수는 `.env.local` 에 둔다. 이름과 쓰임은 [ARCHITECTURE.md §4-2](ARCHITECTURE.md). 없어도 화면은 뜨지만 닉네임 불러오기·코디 광장·공유 링크가 꺼진다.

parser·back 레포와 함께 쓸 때는 세 레포를 같은 폴더에 나란히 받는다(parser 의 캡션 도구가 이 레포의 `src/lib/core` 를 직접 불러 쓴다).
