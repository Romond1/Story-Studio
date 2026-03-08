@echo off
setlocal

REM Story Studio Windows launcher (development mode)
REM This script is safe to double-click from Windows Explorer.
REM %~dp0 is the folder where this BAT file lives.
cd /d "%~dp0"

REM Basic guard: make sure we are in the project root.
if not exist "package.json" (
  echo [ERROR] package.json not found in "%CD%".
  echo Move this BAT file to the Story Studio project root.
  pause
  exit /b 1
)

REM Start the dev server in a NEW maximized terminal window.
REM /MAX starts the window maximized.
REM /k keeps the terminal visible after the command exits.
start "Story Studio Dev" /MAX cmd /k "cd /d ""%~dp0"" && npm run dev"

REM Close this small launcher window (the maximized one keeps running).
exit /b 0
