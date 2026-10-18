@echo off
cd /d "%~dp0"
echo Starting Map Game...
echo.

REM Kill any existing vite dev servers on port 4173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4173.*LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>nul
)

REM Start dev server in background
start "MapGameServer" /min cmd /c "npm.cmd run dev 2>&1"

REM Wait for server to be ready
echo Waiting for dev server...
:wait
timeout /t 1 /nobreak >nul
curl -s http://localhost:4173/ >nul 2>nul
if errorlevel 1 goto wait

REM Open browser
start "" http://localhost:4173/
echo Game is running at http://localhost:4173/
echo Close this window to stop the server.
pause
taskkill /fi "WINDOWTITLE eq MapGameServer" /f >nul 2>nul
