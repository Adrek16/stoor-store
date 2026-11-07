@echo off
REM تشغيل نسخة الإنتاج — ضع ملف .env بجانب هذا الملف أولاً
if not exist .env (
  echo [خطأ] ملف .env غير موجود. انسخ .env.example إلى .env واملأ القيم.
  exit /b 1
)
if "%PORT%"=="" set PORT=3000
node --env-file=.env server.js
