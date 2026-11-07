# نشر متجر «الشجاع» على Vercel — كل الخطوات في أمر واحد.
#
# الاستخدام (من مجلد المشروع):
#   powershell -ExecutionPolicy Bypass -File deploy\vercel-deploy.ps1
#
# ما يفعله:
#   1. يتأكد من تسجيل الدخول (وإن لم تكن مسجلاً يفتح رابط تسجيل الدخول).
#   2. يربط المجلد بمشروع Vercel باسم stoor-store.
#   3. يضيف متغيرات البيئة الستة من .env.local دون طباعة قيمها.
#   4. ينشر نسخة الإنتاج ويطبع الرابط.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$vercel = { param($args) npx --yes vercel@latest @args }

Write-Host "== 1/4 التحقق من تسجيل الدخول ==" -ForegroundColor Cyan
npx --yes vercel@latest whoami 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "لم تسجّل الدخول بعد. سيظهر رابط ورمز — افتح الرابط في متصفحك وأكمل." -ForegroundColor Yellow
  npx --yes vercel@latest login
  if ($LASTEXITCODE -ne 0) { Write-Host "فشل تسجيل الدخول." -ForegroundColor Red; exit 1 }
}

Write-Host "== 2/4 ربط المشروع ==" -ForegroundColor Cyan
"y`nstoor-store`nn`n" | npx --yes vercel@latest link --yes 2>&1 | Select-Object -Last 6 | Out-Host

Write-Host "== 3/4 إضافة متغيرات البيئة ==" -ForegroundColor Cyan
$envFile = Join-Path $root ".env.local"
$wanted = @(
  "SESSION_SECRET",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "STORE_REVALIDATE_SECRET"
)
$map = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*#') { continue }
  if ($line -match '^([A-Z_][A-Z0-9_]*)=(.*)$') {
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
    $map[$name] = $value
  }
}
foreach ($name in $wanted) {
  if (-not $map.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($map[$name])) {
    Write-Host "  تخطي $name (غير موجود)" -ForegroundColor Yellow
    continue
  }
  foreach ($target in @("production", "preview")) {
    $map[$name] | npx --yes vercel@latest env add $name $target --force 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "  ✔ $name → $target" -ForegroundColor Green }
    else { Write-Host "  ✖ $name → $target" -ForegroundColor Red }
  }
}

Write-Host "== 4/4 النشر ==" -ForegroundColor Cyan
$out = npx --yes vercel@latest deploy --prod --yes 2>&1
$out | Select-Object -Last 12 | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host "فشل النشر." -ForegroundColor Red; exit 1 }

$url = ($out | Select-String -Pattern 'https://[a-zA-Z0-9\.\-]+\.vercel\.app' | Select-Object -Last 1).Matches.Value
Write-Host ""
Write-Host "تم النشر: $url" -ForegroundColor Green
