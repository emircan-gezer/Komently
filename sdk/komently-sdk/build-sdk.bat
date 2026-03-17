@echo off
echo Building standalone Komently SDK...
npm run build:sdk
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! Standalone SDK created at dist/sdk/komently.js
) else (
    echo.
    echo Build failed. Please check the logs above.
)
pause
