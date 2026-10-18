@echo off
setlocal
cd /d "%~dp0.."
set "LOGFILE=%~dp0launch-log.txt"
echo Map Game launch started at %date% %time% > "%LOGFILE%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Install Node.js first.
  echo npm.cmd was not found. >> "%LOGFILE%"
  pause
  exit /b 1
)
call npm.cmd install >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo npm install failed.
  echo npm install failed. See %LOGFILE% >> "%LOGFILE%"
  pause
  exit /b 1
)
echo Running build... >> "%LOGFILE%"
call npm.cmd run build >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo npm build failed.
  echo npm build failed. See %LOGFILE% >> "%LOGFILE%"
  pause
  exit /b 1
)
if not exist dist\index.html (
  echo dist\index.html was not created.
  echo dist\index.html was not created. >> "%LOGFILE%"
  pause
  exit /b 1
)
echo Starting local review server... >> "%LOGFILE%"
start "" http://127.0.0.1:4173/
node scripts\serve-dist.mjs >> "%LOGFILE%" 2>&1
