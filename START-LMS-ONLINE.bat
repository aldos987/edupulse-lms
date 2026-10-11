@echo off
title EduPulse LMS - Server Online PJJ
color 0A
cls
echo =======================================================================
echo   EDUPULSE LMS - INFORMATIKA & KKA (PJJ TANGGAP KABUT ASAP)
echo   Memulai Server Online dan Menghubungkan ke Internet...
echo =======================================================================
echo.

cd /d "%~dp0"

echo [1/2] Memeriksa Node.js & Server LMS...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terpasang di komputer ini!
    pause
    exit /b
)

echo [2/2] Membuka Terowongan Online Aman (Cloudflare Tunnel)...
echo Harap tunggu beberapa detik hingga Link Publik muncul...
echo.

node run-tunnel.js
pause
