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
- **`dev` 에서만 일한다.** `main` 에 직접 커밋하지 않고, **병합은 지시가 있을 때만** `sh scripts/merge-dev-to-main.sh` 로 한다(그냥 `git merge` 하지 않는다).
- **확인은 dev 사이트에서.** 올리고 배포를 기다린 뒤 본다. 운영에는 읽기만 하는 확인만 한다.
- **`npm run dev`(포트 80)는 사용자 전용이다.** 백그라운드로도 띄우지 않는다.
- **고쳤다는 보고는 실제로 그려진 결과를 재거나 보고 한다.** 속성·플래그가 아니라 `getComputedStyle`·좌표·캡처. 화면을 못 봤으면 봤다고 하지 않는다.
- **요청 범위 밖을 손대지 않는다.** 고칠 만한 것이 보이면 보고한다.
- **지금 화면이 정본이다.** 새 페이지·기능·요소는 같은 역할의 기존 화면을 본떠 만들고, 있는 부품을 쓴다.
- 커밋 전에 `npx tsc --noEmit --noUnusedLocals`(테스트·린트는 없다).
- 임시 산출물(캡처·실험 파일)을 저장소에 두지 않는다. 세션의 임시 폴더에서 하고 지운다.

## 하지 말 것

- **`src/app/viewer` 를 `main`·운영에 올리지 않는다.** dev 전용 화면이다. 훅(`.githooks`)·워크플로(`guard-dev-only.yml`)·병합 스크립트를 지우거나 우회하지 않는다. 올려야 한다는 지시가 오면 먼저 확인한다.
- **비밀값을 출력하지 않는다.** `.env.local`, 토큰, 관리 API 의 응답 전체(Supabase 는 평범한 조회에도 `jwt_secret` 을 돌려준다). 필요한 필드만 골라 낸다. 저장소와 Vercel 에 서비스 키·비밀번호를 넣지 않는다.
- **운영 DB·운영 사이트에 시험 데이터를 만들지 않는다.** 스키마 변경은 dev 먼저, 운영에 올릴 때는 DB 를 코드보다 먼저.
- **R2 버킷을 통째로 비우지 않는다**(공유 코드가 같은 버킷에 있다).
- `scene/sceneData.ts`·`src/assets/scene/*`·`public/riding/*` 를 손으로 고치지 않는다(parser 가 만든다).
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

`git push` 가 403 / Repository not found 로 실패하면 `gh auth status` 를 본다. 이 PC 에는 GitHub 계정이 여럿이고, 활성 계정이 `teacher-sora` 가 아니면 그렇다. **계정을 바꾸거나 우회하지 말고 사용자에게 알린다.**

## 문서를 고칠 때

구조나 규칙이 바뀌면 `ARCHITECTURE.md` 와 스킬의 **그 자리를 고쳐 쓴다.** 이력·날짜·옛 규칙을 쌓지 않는다(이력은 git 이 맡는다). 새 규칙에는 왜를 한 줄 붙인다.
