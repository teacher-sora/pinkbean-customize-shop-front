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
```

- `main` 에 직접 커밋하지 않는다.
- dev 에 아직 운영에 올리면 안 되는 것이 섞여 있으면 스크립트를 쓰지 말고, `origin/main` 에서 브랜치를 떼어 올릴 것만 올린다.

## 개발 전용 경로

`src/app/viewer`(화면 뷰어)와 `public/dev`(dev 전용 실험 데이터 — 지금은 명찰 · 말풍선 한 세트)는 dev 에만 있다. main 에서 지워도 dev 에는 남아 있어 병합할 때마다 따라오므로, **병합할 때마다 걷어 내고 걷어 냈는지 확인**한다. 그 일을 세 겹으로 한다.

1. `scripts/merge-dev-to-main.sh` — 병합하면서 이 경로를 빼고, 커밋 전·후 두 번 확인한다.
2. 훅(`.githooks`) — 그냥 `git merge` 하거나 main 에 이 경로를 커밋·푸시하려 하면 거부한다. **받은 뒤 한 번 `git config core.hooksPath .githooks` 를 해야 돈다.**
3. GitHub Actions(`.github/workflows/guard-dev-only.yml`) — 훅이 없는 환경에서도 main 에 이 경로가 있으면 실패한다.

셋 다 지우거나 우회하지 않는다.

## 주의

- 코디 광장의 DB(Supabase)는 운영(`public`)과 dev(`plaza_dev`)가 나뉘어 있다. 스키마가 바뀌는 변경은 **운영 DB 를 먼저** 바꾼 뒤 main 을 올린다.
- 백엔드(`pinkbean-customize-shop-back`)는 Fly.io 이고 **수동 배포**(`fly deploy`)다 — 브랜치 병합만으로 반영되지 않는다.
- git 신원은 `teacher-sora <sora05153@gmail.com>`(저장소 로컬 설정), 커밋 메시지는 한국어.
