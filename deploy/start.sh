#!/usr/bin/env sh
set -e
if [ ! -f .env ]; then
  echo "[خطأ] ملف .env غير موجود. انسخ .env.example إلى .env واملأ القيم."
  exit 1
fi
PORT="${PORT:-3000}"
export PORT
exec node --env-file=.env server.js
