@echo off
title Delta Travel 2.0 - Khoi Chay Website
echo ======================================================================
echo           DELTA TRAVEL 2.0 - HE THONG DAT TOUR DU LICH
echo ======================================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tai https://nodejs.org/ (Phien ban LTS)
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [THONG BAO] Dang cai dat thu vien can thiet (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [LOI] Khong the cai dat cac thu vien can thiet qua npm.
        pause
        exit /b 1
    )
)

netstat -ano | findstr :8000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [THONG BAO] Website Delta Travel dang chay san tren cong 8000!
    echo Dang mo trinh duyet den http://127.0.0.1:8000/ ...
    start http://127.0.0.1:8000/
    echo.
    echo Neu ban muon khoi dong lai server:
    echo - Hay dong cua so terminal dang chay server cu hoac chay: taskkill /F /IM node.exe
    echo.
    pause
    exit /b 0
)

echo [OK] Dang khoi chay website Delta Travel va ket noi truc tiep SQL Server...
echo Trang chu:         http://127.0.0.1:8000/
echo Quan tri Admin:    http://127.0.0.1:8000/admin.html
echo.

start "" "http://127.0.0.1:8000/"
node server.js
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo [LOI] Server bi dung voi ma loi %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%
