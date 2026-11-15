@echo off
title Delta Travel - SQL Server Catalog
echo ======================================================================
echo           DELTA TRAVEL 2.0 - SQL SERVER CATALOG
echo ======================================================================
echo.

cd /d "%~dp0"

where powershell.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Windows PowerShell!
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tai https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Dang khoi chay he thong Delta Travel (Node.js + SQL Server)...
echo.

start "" "http://127.0.0.1:8000/"
node "%~dp0server.js"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo [LOI] May chu dung dot ngot voi ma loi: %EXIT_CODE%
    pause
)

exit /b %EXIT_CODE%
