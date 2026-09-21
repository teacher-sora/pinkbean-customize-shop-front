#!/bin/sh
# 개발 전용 경로가 main 에 섞이지 않게 막는다(공용 로직 — 훅 셋이 같이 쓴다).
# 이 파일을 지우거나 경로를 바꾸면 보호가 사라진다. 바꿀 일이 있으면 ARCHITECTURE 의 근거부터 확인할 것.

DEV_ONLY="src/app/viewer"

# 인자로 받은 트리(커밋 sha)에 개발 전용 경로가 있으면 1
tree_has_dev_only() {
  git ls-tree -r --name-only "$1" -- "$DEV_ONLY" 2>/dev/null | grep -q .
}

# 지금 인덱스(스테이지된 내용)에 개발 전용 경로가 있으면 1
index_has_dev_only() {
  git ls-files -- "$DEV_ONLY" 2>/dev/null | grep -q .
}

dev_only_msg() {
  echo ""
  echo "  ✗ 개발 전용 화면이 main 에 들어가려 합니다: $DEV_ONLY"
  echo ""
  echo "  /viewer 는 dev 에서만 삽니다. dev → main 병합은 아래로 하세요:"
  echo "      sh scripts/merge-dev-to-main.sh"
  echo "  (병합하면서 이 경로를 빼고 커밋합니다)"
  echo ""
}
