@echo off
cd /d "%~dp0"
echo サーバーを起動しています...
start "" http://localhost:8000
python server_coi.py
pause
