@echo off
rem Double-click to start the WhatsApp sender and open its page.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules (
  echo Installing, first time only. This takes a minute...
  call npm install || (pause & exit /b 1)
)
if not exist .env copy .env.example .env >nul
start "" http://localhost:3000
call npm run server
pause
