@echo off
title Delta Travel Server
echo Dang khoi dong Delta Travel Server...
cd /d "%~dp0API"
python -m uvicorn api.app:app --host 127.0.0.1 --port 8000 --reload
pause

