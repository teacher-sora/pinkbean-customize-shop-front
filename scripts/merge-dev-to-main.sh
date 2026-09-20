#!/bin/sh
# dev → main 병합 — 개발 전용 화면(/viewer)을 빼고 커밋한다.
# 매 병합마다 필요하다: main 에서 지워도 dev 에는 남아 있으므로 다음 병합에서 다시 따라온다.
set -e

DEV_ONLY="src/app/viewer"
cd "$(dirname "$0")/.."

[ -z "$(git status --porcelain)" ] || { echo "✗ 작업 트리가 깨끗해야 합니다."; exit 1; }

git checkout main
git pull --ff-only origin main
git fetch origin dev
git merge --no-ff --no-commit origin/dev || {
  echo "✗ 충돌이 있습니다. 해결한 뒤 이 스크립트를 다시 실행하세요."
  exit 1
}

if git ls-files -- "$DEV_ONLY" | grep -q .; then
  git rm -r -q "$DEV_ONLY"
  echo "· $DEV_ONLY 를 빼고 병합합니다(dev 전용)."
fi

git commit --no-edit -m "Merge branch 'dev' into main"
echo "· 병합 완료. 확인 후 'git push origin main' 하세요."
