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

if not exist "API\.venv\Scripts\python.exe" (
    echo [LOI] Chua co API\.venv. Xem muc SQL Server trong README.md de cai dat.
    pause
    exit /b 1
)

echo [OK] Dang ket noi SQL Server va khoi chay website...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_sqlserver_catalog.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo [LOI] Khong the khoi dong che do SQL Server. Kiem tra API, ODBC, mang va thong tin ket noi.
    pause
)

exit /b %EXIT_CODE%
