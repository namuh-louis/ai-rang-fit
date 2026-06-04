#!/usr/bin/env bash
# GitHub에 첫 푸시 (gh CLI 있으면 저장소 자동 생성)
set -e
cd "$(dirname "$0")/.."

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "git init 후 다시 실행하세요."
  exit 1
fi

git branch -M main 2>/dev/null || true

if command -v gh >/dev/null 2>&1; then
  gh auth status
  gh repo create ai-rang-fit --public --source=. --remote=origin --push \
    --description "아이랑 핏 — 육아 올인원 모바일 웹"
  echo "완료: gh repo view --web"
  echo "다음: Vercel https://vercel.com/new → Import Git Repository → ai-rang-fit"
else
  echo "gh CLI가 없습니다. 아래를 수동으로 진행하세요:"
  echo ""
  echo "1) https://github.com/new 에서 저장소 이름: ai-rang-fit (Public)"
  echo "2) 터미널:"
  echo "   git remote add origin https://github.com/<YOUR_USER>/ai-rang-fit.git"
  echo "   git push -u origin main"
  echo ""
  echo "3) https://vercel.com/new → GitHub ai-rang-fit Import → Deploy"
  echo ""
  echo "또는: brew install gh && gh auth login 후 이 스크립트 재실행"
fi
