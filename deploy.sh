#!/usr/bin/env bash
# 在 VPS 上一键更新部署：拉代码 → 必要时装依赖 → 零停机重载 → 健康检查
# 用法（VPS 上）：./deploy.sh
# 可通过环境变量覆盖：APP_DIR=/opt/word-cloud PM2_NAME=word-cloud HEALTH_URL=http://127.0.0.1:1234/api/health ./deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/word-cloud}"
PM2_NAME="${PM2_NAME:-word-cloud}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:1234/api/health}"

cd "$APP_DIR"

old_lock=$(sha256sum package-lock.json 2>/dev/null | awk '{print $1}' || true)
echo "[deploy] git pull --ff-only"
git pull --ff-only
new_lock=$(sha256sum package-lock.json 2>/dev/null | awk '{print $1}' || true)

if [ "$old_lock" != "$new_lock" ]; then
  echo "[deploy] package-lock.json changed -> npm ci"
  npm ci --no-audit --no-fund
else
  echo "[deploy] dependencies unchanged -> skip npm ci"
fi

# Build Tailwind CSS if node_modules exists (pin v3 兼容 --omit=dev 时 npx 自动下载)
if [ -d node_modules ]; then
  echo "[deploy] building tailwind CSS"
  npx tailwindcss@^3 -i public/css/tailwind-input.css -o public/css/tailwind.css --minify
else
  echo "[deploy] node_modules not found, skipping CSS build (using committed version)"
fi

echo "[deploy] pm2 restart ecosystem.config.cjs"
pm2 restart ecosystem.config.cjs --update-env >/dev/null

echo "[deploy] health check $HEALTH_URL"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if body=$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null); then
    echo "$body"
    echo "[deploy] OK"
    exit 0
  fi
  sleep 1
done
echo "[deploy] FAILED: health check did not pass within 10s" >&2
pm2 logs "$PM2_NAME" --lines 20 --nostream 2>&1 | tail -30 >&2 || true
exit 1
