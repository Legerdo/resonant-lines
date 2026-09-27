@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is required. Install Node.js LTS and run this file again.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Reinstall Node.js LTS and run this file again.
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    echo Installing project dependencies...
    call npm install
    if errorlevel 1 (
        echo Dependency installation failed.
        pause
        exit /b 1
    )
)

call npm run dev -- --open
