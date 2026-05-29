#!/usr/bin/env bash
# 在 VPS 上一键更新部署：拉代码 → 必要时装依赖 → 零停机重载 → 健康检查
# 用法（VPS 上）：./deploy.sh
# 可通过环境变量覆盖：APP_DIR=/opt/word-cloud PM2_NAME=word-cloud HEALTH_URL=http://127.0.0.1:1234/api/health ./deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/word-cloud}"
PM2_NAME="${PM2_NAME:-word-cloud}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:1234/api/health}"

cd "$APP_DIR"

old_lock=$(sha256sum server/package-lock.json 2>/dev/null | awk '{print $1}' || true)
echo "[deploy] git pull --ff-only"
git pull --ff-only
new_lock=$(sha256sum server/package-lock.json 2>/dev/null | awk '{print $1}' || true)

cd server
if [ "$old_lock" != "$new_lock" ]; then
  echo "[deploy] package-lock.json changed -> npm ci --omit=dev"
  npm ci --omit=dev --no-audit --no-fund
else
  echo "[deploy] dependencies unchanged -> skip npm ci"
fi

echo "[deploy] pm2 reload $PM2_NAME"
pm2 reload "$PM2_NAME" --update-env >/dev/null

sleep 1
echo "[deploy] health check $HEALTH_URL"
curl -fsS --max-time 5 "$HEALTH_URL" && echo
echo "[deploy] OK"
