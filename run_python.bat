@echo off
title Delta Travel Server (Python FastAPI)
echo Dang khoi dong Delta Travel Server (Python)...
cd /d "%~dp0API"
python -m uvicorn api.app:app --host 127.0.0.1 --port 8000 --reload
pause
