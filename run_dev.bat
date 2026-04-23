@echo off
chcp 65001 >nul
title ميزان POS — تشغيل تجريبي

if not exist "node_modules" (
    echo ⏳ تثبيت أول مرة...
    npm install
)

echo ⏳ تشغيل ميزان POS في وضع التطوير...
npm start
