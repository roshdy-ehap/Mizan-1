@echo off
chcp 65001 >nul
color 0B
title ميزان POS — بناء EXE بـ Electron

echo.
echo  ╔════════════════════════════════════════════════════╗
echo  ║        ميزان POS — بناء الإصدار الكامل           ║
echo  ║   النتيجة: EXE واحد يشتغل على أي Windows         ║
echo  ║   بدون Python، بدون تثبيت، بدون انترنت           ║
echo  ╚════════════════════════════════════════════════════╝
echo.

:: ── التحقق من Node.js ────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  ✗ Node.js غير مثبت على جهازك
    echo.
    echo  حمّله مرة واحدة فقط من:
    echo  https://nodejs.org  (اختر LTS)
    echo.
    echo  بعد التثبيت، شغّل هذا الملف مرة ثانية
    pause & exit /b 1
)

echo  ✓ Node.js موجود: 
node --version

:: ── تثبيت المكتبات (أول مرة فقط) ───────────────────────
if not exist "node_modules" (
    echo.
    echo  ⏳ تثبيت Electron ^(مرة واحدة فقط، قد يأخذ 3-5 دقائق^)...
    npm install --prefer-offline
    if errorlevel 1 (
        echo  ✗ فشل تثبيت المكتبات، تأكد من الاتصال بالإنترنت
        pause & exit /b 1
    )
    echo  ✓ تم تثبيت المكتبات
)

:: ── بناء الـ EXE ──────────────────────────────────────────
echo.
echo  ⏳ جاري بناء ميزان-POS.exe ...
echo  هذا يأخذ 3-8 دقائق في أول مرة
echo.

npm run build-portable

echo.
if exist "dist\ميزان-POS-*.exe" (
    color 0A
    echo  ╔════════════════════════════════════════════════════╗
    echo  ║   ✓ تم بناء الملف بنجاح!                        ║
    echo  ║                                                    ║
    echo  ║   الملف موجود في مجلد: dist\                     ║
    echo  ║                                                    ║
    echo  ║   انقله لأي جهاز Windows وشغّله مباشرة           ║
    echo  ║   لا يحتاج Python أو أي تثبيت                    ║
    echo  ╚════════════════════════════════════════════════════╝
    echo.
    start "" dist
) else (
    color 0C
    echo  ✗ لم يُنشأ الملف — اقرأ الأخطاء أعلاه
)

pause
