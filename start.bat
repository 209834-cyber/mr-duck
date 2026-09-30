@echo off
cd /d "%~dp0"
rem Local admin code (do NOT upload this file to GitHub)
set ADMIN_CODE=4421442144
call npm install
start "" http://localhost:3000
call npm start
pause
