# 브랜치 · 배포

## 브랜치
| 브랜치 | 용도 | 배포 |
|---|---|---|
| `main` | 운영 | push 하면 `pinkbean-customize.com` 에 반영 |
| `dev` | 확인용 | push 하면 `dev.pinkbean-customize.com` 에 반영 |

Vercel 프로젝트에 이 저장소가 연결돼 있어 **push 만으로 배포된다.**

## 흐름
```
dev 에 커밋·push → dev 사이트에서 확인 → (지시가 있을 때) main 으로 병합 → 운영 반영
```

```bash
# 1) dev 로
git push origin dev

# 2) 확인이 끝나면 운영으로 — 반드시 스크립트로 병합한다
sh scripts/merge-dev-to-main.sh
git push origin main
git checkout dev
```

## 개발 전용 경로
`src/app/viewer`(화면 뷰어)는 dev 에만 있다. `merge-dev-to-main.sh` 가 병합하면서 이 경로를 빼고,
커밋 전·후 두 번 확인한다. 그냥 `git merge` 하면 훅(`.githooks`, `core.hooksPath=.githooks`)이 거부하고,
훅이 없는 환경은 GitHub Actions(`guard-dev-only.yml`)가 막는다. 셋 다 지우거나 우회하지 않는다.

dev 에 아직 운영에 올리면 안 되는 기능이 섞여 있으면 스크립트를 쓰지 말고, `origin/main` 에서 브랜치를 떼어 그 기능만 올린다.

## 주의
- `main` 에 직접 커밋하지 않는다.
- 코디 광장의 DB(Supabase)는 운영(`public`)과 dev(`plaza_dev`)가 나뉘어 있다. 스키마가 바뀌는 변경은 **운영 DB 를 먼저** 바꾼 뒤 main 을 올린다.
- 백엔드(`pinkbean-customize-shop-back`)는 Fly.io 이고 **수동 배포**(`fly deploy`)다 — 브랜치 병합만으로 반영되지 않는다.
