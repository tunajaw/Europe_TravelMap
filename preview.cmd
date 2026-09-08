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

call npm.cmd run build
if errorlevel 1 exit /b %errorlevel%

call npm.cmd run preview -- --host 127.0.0.1 --port 4173 --open /Europe_TravelMap/
