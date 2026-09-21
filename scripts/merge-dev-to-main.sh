#!/bin/sh
# dev → main 병합 — 개발 전용 경로를 **영구히** 빼고 커밋한다.
#
# 왜 매번 필요한가: main 에서 지워도 dev 에는 그대로 남아 있어, 다음 병합에서 또 따라온다.
# 그래서 "한 번 지우면 끝"이 될 수 없고, 병합할 때마다 걷어내고 **걷어냈는지 확인**해야 한다.
# 이 스크립트가 마지막 관문이고, 그 앞에 훅(.githooks)과 CI(guard-dev-only.yml)가 더 있다.
#
# ⚠️ dev 에는 코디 광장처럼 아직 운영에 올리지 않을 기능이 섞여 있을 수 있다.
#    그럴 때는 이 스크립트를 쓰지 말고 origin/main 에서 브랜치를 떼어 그 기능만 올린다.
set -e

# 운영에 절대 올라가면 안 되는 경로. 늘어나면 여기에만 추가한다.
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

for p in $DEV_ONLY; do
  if git ls-files -- "$p" | grep -q .; then
    git rm -r -f -q "$p"
    echo "· $p 를 빼고 병합합니다(dev 전용)."
  fi
done

# 커밋 **전** 확인: 스테이지에 개발 전용 경로가 하나라도 남아 있으면 중단한다.
for p in $DEV_ONLY; do
  if git ls-files -- "$p" | grep -q .; then
    echo "✗ $p 가 아직 남아 있습니다. 병합을 되돌립니다."
    git merge --abort 2>/dev/null || git reset --hard HEAD
    exit 1
  fi
done

git commit --no-edit -m "Merge branch 'dev' into main"

# 커밋 **후** 확인: 만들어진 커밋의 트리에도 없는지 본다(rm 이 빠졌거나 되살아난 경우).
for p in $DEV_ONLY; do
  if git ls-tree -r HEAD --name-only | grep -q "^$p"; then
    echo "✗ 커밋된 트리에 $p 가 있습니다. 이 커밋을 되돌립니다."
    git reset --hard HEAD~1
    exit 1
  fi
done

echo "· 병합 완료(개발 전용 경로 없음 확인). 확인 후 'git push origin main' 하세요."
