# 핑크빈 커마샵 front — 세션 지침

메이플스토리 캐릭터 코디 웹앱의 프론트엔드(Next.js 14 App Router · React 18 · TypeScript). **운영 중인 서비스다.**
`main` → `pinkbean-customize.com`, `dev` → `dev.pinkbean-customize.com`. push 하면 Vercel 이 배포한다.

## 먼저 읽을 것

- [ARCHITECTURE.md](ARCHITECTURE.md) — 구조와 규칙, 그 이유. 고칠 곳의 절부터 읽는다.
- 화면을 만들거나 고칠 때: `.claude/skills/pinkbean-design`(값·부품·피할 것). 확인할 때: `.claude/skills/pinkbean-screencheck`.
- [CONTRIBUTING.md](CONTRIBUTING.md) — 브랜치와 병합.
- 아이템 데이터·캡션은 parser 레포, AI 검색은 back 레포다(각자 `ARCHITECTURE.md` 가 있다). 세 레포는 같은 폴더에 나란히 둔다.

## 일하는 방식

- **답은 한국어로.** 진행 문구와 보고 모두. 주석·커밋 메시지도 한국어.
- **`dev` 에서만 일한다.** `main` 에 직접 커밋하지 않고, **병합은 지시가 있을 때만** `sh scripts/merge-dev-to-main.sh` 로 한다(그냥 `git merge` 하지 않는다). 병합할 때 dev 데이터를 지운다(아래 '시험 데이터').
- **버그는 발견하는 즉시 핫픽스로 `main`(운영)까지 올린다**(사용자 지시 2026-10-20 — 어떤 작업 중이든, 지시를 기다리지 않는다). `origin/main` 에서 브랜치를 떼어 그 수정만 커밋하고 `git merge --no-ff` 병합 커밋으로 올린 뒤, 같은 수정을 `dev` 에도 넣는다. dev 에만 있는 기능 · 디자인 작업은 섞지 않는다(그건 지금처럼 지시가 있을 때만). 올리기 전에 dev 데이터를 지우고(아래 '시험 데이터'), 보고에 '버그라서 바로 올렸다'고 적는다. front 는 main 에 **일반 커밋을 올리면 Vercel 이 배포하지 않는다** — 반드시 병합 커밋으로 올리고, 배포가 성공했는지(`gh api …/deployments?sha=`) 본다. 병합 결과에 `src/app/viewer` 가 없어야 한다.
- **확인은 dev 사이트에서.** 올리고 배포를 기다린 뒤 본다. 운영에는 읽기만 하는 확인만 한다.
- **`npm run dev`(포트 80)는 사용자 전용이다.** 백그라운드로도 띄우지 않는다.
- **고쳤다는 보고는 실제로 그려진 결과를 재거나 보고 한다.** 속성·플래그가 아니라 `getComputedStyle`·좌표·캡처. 화면을 못 봤으면 봤다고 하지 않는다.
- **요청 범위 밖을 손대지 않는다.** 고칠 만한 것이 보이면 보고한다.
- **지금 화면이 정본이다.** 새 페이지·기능·요소는 같은 역할의 기존 화면을 본떠 만들고, 있는 부품을 쓴다.
- 커밋 전에 `npx tsc --noEmit --noUnusedLocals`(테스트·린트는 없다).
- 임시 산출물(캡처·실험 파일)을 저장소에 두지 않는다. 세션의 임시 폴더에서 하고 지운다.
- **저장소를 깨끗하게 둔다(사용자 지시).** 바꾸거나 없앤 것의 흔적을 남기지 않는다. 쓰지 않게 된 아이콘 · 부품 · 함수 · 타입 · CSS 클래스 · 그림 · 파일은 그 작업 안에서 지운다. 같은 역할의 아이콘 · 부품이 둘이 되면 최신 하나로 합치고 옛것을 지운다(아이콘은 `ui/Icons.tsx` 한 곳, 그림이 같은 아이콘은 경로도 한 번만 적는다). 끝내기 전에 이번에 건드린 이름 · 클래스가 아직 쓰이는지 찾아본다. 왜: 남은 옛것이 다음 작업에서 정본처럼 다시 쓰인다(모달의 공지 아이콘이 하단 탭과 달랐다).

## 시험 데이터 — Supabase 에 남기지 않는다

Supabase(프로젝트 `pinkbean-customize`)에는 **운영 데이터만** 남긴다. 확인·측정·시험으로 생긴 것은 그 작업 안에서 없앤다.

- **사이트를 열기만 해도 익명 계정이 하나 생긴다**(코디 광장이 첫 화면 뒤에 기기 귀속용 세션을 만든다 — 운영 · dev 가 같은 계정 표를 쓴다). 자동화 브라우저나 스크립트로 열 때는 **`*.supabase.co/auth/` 요청을 막고 연다.** `pinkbean-screencheck` 의 `shots.mjs` 는 기본으로 막는다. playwright 를 직접 쓸 때:
  ```js
  await page.route((u) => u.host.endsWith('supabase.co') && u.pathname.startsWith('/auth/'), (r) => r.abort())
  ```
  막아도 목록 · 미리보기 · 광장 읽기는 그대로 된다. 등록 · 좋아요 · 댓글처럼 세션이 있어야 하는 확인만 막지 않고 한다(`shots.mjs --auth`).
- **글 · 댓글 · 좋아요 · 공지 시험은 dev 사이트에서만 한다**(dev 는 스키마 `plaza_dev` · 버킷 `plaza-dev` 를 쓴다). 운영 사이트에서는 읽기만 한다.
- **`main` 에 병합할 때마다 dev 데이터를 지운다.** 병합 전에 `node scripts/clean-test-data.mjs` 로 세어 보고 `--apply` 로 지운다 — dev 광장의 모든 행, dev 그림, 자동화로 생긴 익명 계정이 없어지고 운영 데이터는 그대로다(무엇을 어떤 기준으로 지우는지는 그 파일 머리말). 병합 없이 끝나는 작업도 계정이나 글을 만들었으면 끝에 돌린다.
- 키는 `SUPABASE_TOKEN`(환경변수 또는 `.env.local`). 없으면 지우지 못한 것을 **보고한다** — 남긴 채로 끝났다고 하지 않는다.

## 하지 말 것

- **`src/app/viewer` · `public/dev` 를 `main`·운영에 올리지 않는다.** dev 전용 화면과 실험 데이터다. 훅(`.githooks`)·워크플로(`guard-dev-only.yml`)·병합 스크립트를 지우거나 우회하지 않는다. 올려야 한다는 지시가 오면 먼저 확인한다.
- **안내 글(`/guide`)로 가는 링크를 앱에 두지 않는다.** 검색엔진이 읽으라고 둔 글이고 정식 페이지가 아니다. 보이지 않는 요약에도 넣지 않는다(ARCHITECTURE 2-5).
- **화면의 글자, 제목, 안내 글에 가운뎃점(`·`)을 구분자로 쓰지 않는다.** 쉼표, 붙임표, 빗금, 세로줄을 쓴다. 색 있는 상태 점, 네온도 쓰지 않는다. 화면의 글은 아주 짧게, 가능하면 직접 그린 SVG + 짧은 낱말로(`pinkbean-design` 스킬).
- **비밀값을 출력하지 않는다.** `.env.local`, 토큰, 관리 API 의 응답 전체(Supabase 는 평범한 조회에도 `jwt_secret` 을 돌려준다). 필요한 필드만 골라 낸다. 저장소와 Vercel 에 서비스 키·비밀번호를 넣지 않는다.
- **운영 DB·운영 사이트에 시험 데이터를 만들지 않는다**(위 '시험 데이터'). 스키마 변경은 dev 먼저, 운영에 올릴 때는 DB 를 코드보다 먼저.
- **R2 버킷을 통째로 비우지 않는다**(공유 코드가 같은 버킷에 있다).
- `scene/sceneData.ts`·`src/assets/scene/*`·`public/riding/*`·`src/assets/pinkbean.png`·`preview/pinkbeanData.ts` 를 손으로 고치지 않는다(parser 가 만든다). `lib/core/dyeWasmBin.ts` 도 손으로 고치지 않는다(`scripts/build-wasm.sh` 가 `wasm/dye.c` 로 만든다).
- **`lib/core/dye.ts` 의 픽셀 루프를 고치면 `wasm/dye.c` 도 같이 고치고 `node wasm/check.cjs` 가 통과해야 한다**(둘의 결과가 바이트까지 같아야 한다).
- ARCHITECTURE §5 의 "하지 않기로 한 것"을 묻지 않고 되살리지 않는다.
- 코디 광장의 식별 방식은 사용자에게 "기기 귀속"이라고 설명한다("익명 로그인"이라고 하지 않는다).

## 받은 뒤 한 번

```bash
npm install
git config user.name teacher-sora
git config user.email sora05153@gmail.com
git config core.hooksPath .githooks      # /viewer 가 main 에 섞이지 않게 막는 훅
```

`.env.local` 에 넣을 이름은 ARCHITECTURE §4-2. 타입 검사는 `next dev`·`next build` 를 한 번 돌린 뒤에 된다(`next-env.d.ts` 가 그때 생긴다).

**GitHub 작업은 `teacher-sora` 계정으로 한다.** 이 PC 에는 GitHub 계정이 여럿이다. push 전에 `gh auth status` 로 지금 활성 계정을 적어 두고, `teacher-sora` 가 아니면 `gh auth switch -u teacher-sora` 로 바꿔 작업한 뒤, **끝나면 `gh auth switch -u <적어 둔 계정>` 으로 원래대로 되돌린다**(사용자 지시). `git push` 가 403 / Repository not found 로 실패하는 것도 대개 활성 계정이 다른 탓이다.

**dev · main 에 push 하면 자동으로 배포된다.** Vercel 이 이 GitHub 저장소에 연결돼 있어 `dev` → dev 사이트, `main` → 운영 사이트다(GitHub Actions 가 아니다 — `.github/workflows/guard-dev-only.yml` 은 배포가 아니라 dev 전용 경로를 막는 검사다). `main` 병합이 곧 운영 배포다.

## 문서를 고칠 때

구조나 규칙이 바뀌면 `ARCHITECTURE.md` 와 스킬의 **그 자리를 고쳐 쓴다.** 이력·날짜·옛 규칙을 쌓지 않는다(이력은 git 이 맡는다). 새 규칙에는 왜를 한 줄 붙인다.
