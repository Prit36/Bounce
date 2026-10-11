@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to start the local player. Install Node.js from nodejs.org.
  pause
  exit /b 1
)
node scripts\build.mjs
if errorlevel 1 (
  echo Build failed. See the message above.
  pause
  exit /b 1
)
start "" "http://localhost:4173"
node scripts\serve.mjs
pause
