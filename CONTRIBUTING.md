# 브랜치 · 배포 워크플로우

## 브랜치
| 브랜치 | 용도 | 배포 |
|---|---|---|
| `main` | **실서버(프로덕션)** | push 시 **자동으로 pinkbean-customize.com 에 반영** |
| `dev` | **확인용(코드 스테이징)** | **배포 안 함** — 로컬(`npm run dev`)에서 확인 |
| `feat/*`, `fix/*`, `chore/*` | 작업 단위 | 배포 안 함 |

## 기본 흐름
```
feat/xxx  →  dev  (여기서 확인)  →  main  (실서버)
```
1. 작업 브랜치에서 커밋 → **`dev` 에 머지·푸시**
2. **로컬에서 확인**(`npm run dev`). 자잘한 수정·테스트 기능은 `dev` 에 계속 쌓아둔다.
3. 문제 없음이 확인되면 **`dev` → `main` 머지** → 실서버 반영

```bash
# 1) 작업 → dev 로 (배포되지 않는다)
git checkout dev && git merge --no-ff feat/xxx && git push origin dev
#    → 로컬 npm run dev 로 확인

# 2) 확인 끝나면 실서버로
git checkout main && git merge --no-ff dev && git push origin main
#    → pinkbean-customize.com 자동 반영
```

## 배포가 어떻게 걸려 있나 (중요)
- Vercel **프로젝트에 GitHub 저장소가 연결**돼 있어(productionBranch=`main`) **push 만으로 배포된다.**
  GitHub Actions 워크플로우는 **없다** — 예전엔 CLI 수동 배포라 main 에 머지해도 사이트에 반영되지
  않는 사고가 있었고, 그래서 Git 연동으로 전환했다.
- **프리뷰 배포는 꺼져 있다.** Vercel 프로젝트의 Ignored Build Step 에
  `[ "$VERCEL_ENV" != "production" ]` 를 걸어 **프로덕션이 아니면 빌드를 취소**한다.
  (Vercel 규칙: 이 명령이 exit 0 이면 빌드 취소, exit 1 이면 빌드 진행.)
  **왜**: CDN(cdn.pinkbean-customize.com)이 실서버 도메인에만 이미지를 내주므로 프리뷰는 어차피
  이미지가 깨진다 → 쓸모없는 빌드만 도는 셈. 확인은 로컬에서 한다.

## 주의
- **`main` 에 직접 커밋하지 말 것.** 실서버로 바로 나간다.
- `dev` 는 실험이 쌓이는 곳이라 언제든 `main` 기준으로 리셋될 수 있다.
- 프리뷰를 다시 켜려면 Vercel → Settings → Git → Ignored Build Step 을 비우면 된다.
- 백엔드(`pinkbean-customize-shop-back`)는 Fly.io 이고 **수동 배포**(`flyctl deploy`)다 — 브랜치 머지만으로 반영되지 않는다.
