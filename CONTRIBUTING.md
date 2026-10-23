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

# 2) 확인이 끝나고 지시가 있으면 운영으로 — 반드시 스크립트로 병합한다
sh scripts/merge-dev-to-main.sh      # 작업 트리가 깨끗해야 한다. main 으로 옮겨 병합 커밋을 만든다
git push origin main
git checkout dev
git merge --ff-only origin/main      # 3) dev 를 main 과 같은 커밋으로 앞당긴다
git push origin dev
```

- `main` 에 직접 커밋하지 않는다.
- **운영 병합은 핫픽스도 늘 dev → main 순서다**(사용자 지시 2026-10-23). main 에서 브랜치를 떼어 main 에 먼저 넣고 dev 에 복사하지 않는다 — 같은 수정이 두 커밋 번호로 갈라져 '밀린 커밋'이 쌓인다.
- 병합이 끝나면 `git rev-list --count origin/dev..origin/main` 과 `git rev-list --count origin/main..origin/dev` 가 둘 다 0 이어야 한다.
- 그래서 dev 에 운영에 아직 올리면 안 되는 것을 남겨 두지 않는다(그런 작업은 dev 에 넣기 전에 따로 브랜치에서 한다).

## 개발 전용 경로

`src/app/viewer`(화면 뷰어)와 `public/dev`(dev 전용 실험 데이터 자리 — 지금은 비어 있다)는 dev 에만 있다. main 에서 지워도 dev 에는 남아 있어 병합할 때마다 따라오므로, **병합할 때마다 걷어 내고 걷어 냈는지 확인**한다. 그 일을 세 겹으로 한다.

1. `scripts/merge-dev-to-main.sh` — 병합하면서 이 경로를 빼고, 커밋 전·후 두 번 확인한다.
2. 훅(`.githooks`) — 그냥 `git merge` 하거나 main 에 이 경로를 커밋·푸시하려 하면 거부한다. **받은 뒤 한 번 `git config core.hooksPath .githooks` 를 해야 돈다.**
3. GitHub Actions(`.github/workflows/guard-dev-only.yml`) — 훅이 없는 환경에서도 main 에 이 경로가 있으면 실패한다.

셋 다 지우거나 우회하지 않는다.

## 주의

- 코디 광장의 DB(Supabase)는 운영(`public`)과 dev(`plaza_dev`)가 나뉘어 있다. 스키마가 바뀌는 변경은 **운영 DB 를 먼저** 바꾼 뒤 main 을 올린다.
- 백엔드(`pinkbean-customize-shop-back`)는 Fly.io 이고 **수동 배포**(`fly deploy`)다 — 브랜치 병합만으로 반영되지 않는다.
- git 신원은 `teacher-sora <sora05153@gmail.com>`(저장소 로컬 설정), 커밋 메시지는 한국어.
