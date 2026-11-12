@echo off
setlocal
cd /d "%~dp0"

if exist ".tools\node-v24.20.0-win-x64\node.exe" (
  set "PATH=%CD%\.tools\node-v24.20.0-win-x64;%PATH%"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js 24 or the repository-local Node.js runtime is required.
    exit /b 1
  )
)

echo Starting the local development preview with POI image review enabled.
echo Open http://127.0.0.1:4183/Europe_TravelMap/
echo Image assignments are saved in this browser at this address.
echo If port 4183 is already running, use that page or stop its server first.

call npm.cmd run dev -- --host 127.0.0.1 --port 4183 --strictPort --open /Europe_TravelMap/
exit /b %errorlevel%
