@echo off
title Delta Travel Commercial Server (Node.js)
echo ======================================================================
echo           DELTA TRAVEL 2.0 - MAY CHU NODE.JS COMMERCIAL
echo ======================================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tai https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo [THONG BAO] Dang cai dat thu vien Node.js (express, cors, cookie-parser)...
    call npm install
    if %errorlevel% neq 0 (
        echo [LOI] Cai dat thu vien that bai!
        pause
        exit /b 1
    )
)

echo [OK] Dang khoi chay he thong tai http://127.0.0.1:8000 ...
echo [OK] Nhan Ctrl+C de dung server.
echo.

node server.js

pause
