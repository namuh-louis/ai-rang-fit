#!/usr/bin/env bash
# GitHub 푸시 후 Vercel 프로덕션 배포
set -e
cd "$(dirname "$0")/.."

echo "=== 1/2 GitHub ==="
if ! git remote get-url origin &>/dev/null; then
  echo "origin 없음. ./scripts/push-github.sh 먼저 실행하세요."
  exit 1
fi
git push origin main

echo ""
echo "=== 2/2 Vercel ==="
if ! command -v vercel &>/dev/null; then
  npm install -g vercel
fi
vercel login
vercel link --yes 2>/dev/null || vercel link
vercel --prod

echo ""
echo "배포 URL:"
vercel ls 2>/dev/null | head -5 || true
