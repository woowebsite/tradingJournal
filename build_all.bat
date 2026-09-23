@echo off
title Build Trading Journal - Production
echo ======================================================================
echo   BAT DAU BUILD TOAN BO DU AN TRADING JOURNAL CHO PRODUCTION
echo ======================================================================
echo.

echo [1/2] Dang build Backend (Strapi)...
cd /d "%~dp0backend"
call yarn run build:prod
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend build bi loi!
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Backend build thanh cong!
echo.

echo [2/2] Dang build Frontend (Vite + React)...
cd /d "%~dp0frontend"
call yarn run build:prod
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build bi loi!
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Frontend build thanh cong!
echo.

echo ======================================================================
echo   BUILD HOAN TAT THANH CONG!
echo   Ban co the chay "run prod.bat" de khoi dong voi toc do toi uu nhat.
echo ======================================================================
pause
